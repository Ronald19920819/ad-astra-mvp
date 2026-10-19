-- AD Astra Store -- forward-only correction. Stage B11 functional testing
-- against a real staging database (not source-inspection -- the first
-- time either function had ever actually executed) found that BOTH
-- request_store_redemption() and admin_decline_store_redemption() raise
-- "column reference \"status\" is ambiguous" whenever they reach a bare,
-- unqualified `status` reference to public.store_redemptions.status.
--
-- Root cause: both functions declare `returns table (..., status text)`.
-- In PL/pgSQL, every column named in a RETURNS TABLE clause becomes an
-- implicitly-declared variable in scope for the entire function body --
-- it silently shadows any unqualified `status` column reference in the
-- same scope, and Postgres only raises the ambiguity error once such a
-- query actually executes (never at CREATE FUNCTION time).
--
-- This migration re-defines both functions via CREATE OR REPLACE,
-- identical in every other respect to 202610160003/202610160004 --
-- same parameters, same returned columns, same auth/authorization
-- checks, same advisory-lock key and ordering, same idempotency,
-- same catalogue allowlist, same refund amount/reference logic, same
-- grants. The only change in each is qualifying every previously bare
-- `status` reference with the `sr` table alias already used elsewhere
-- in these same functions.
--
-- The two already-applied migrations (202610160003, 202610160004) are
-- NOT edited -- this is a new, additive migration, per this codebase's
-- forward-only convention.

create or replace function public.request_store_redemption(
  p_catalogue_item_id text,
  p_idempotency_key uuid
)
returns table (
  redemption_id uuid,
  transaction_id uuid,
  new_balance integer,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_learner_id uuid;
  v_provider text;
  v_rand_value integer;
  v_coin_cost integer;
  v_current_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
  v_redemption_id uuid;
  v_redemptions_enabled boolean;
  v_existing_redemption_id uuid;
  v_existing_transaction_id uuid;
  v_existing_status text;
begin
  v_learner_id := auth.uid();
  if v_learner_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = 'P0001';
  end if;

  if p_idempotency_key is null then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.profiles
    join public.learner_profiles
      on learner_profiles.profile_id = profiles.id
    where profiles.auth_user_id = v_learner_id
      and profiles.role = 'learner'
      and learner_profiles.status = 'active'
  ) then
    raise exception 'ACTIVE_LEARNER_REQUIRED' using errcode = 'P0001';
  end if;

  -- Serialises this learner's concurrent redemption attempts (and any
  -- concurrent admin Coin adjustment/refund for the same learner)
  -- against each other -- released automatically at transaction end,
  -- never held across the function call boundary. Identical lock key to
  -- admin_adjust_learner_coins().
  perform pg_advisory_xact_lock(hashtext(v_learner_id::text));

  -- Idempotency check happens AFTER acquiring the lock, so a genuinely
  -- concurrent retry with the same key can never race past this point
  -- twice and create two rows.
  select sr.id, sr.deduction_transaction_id, sr.status
    into v_existing_redemption_id, v_existing_transaction_id, v_existing_status
  from public.store_redemptions sr
  where sr.learner_id = v_learner_id
    and sr.idempotency_key = p_idempotency_key;

  if v_existing_redemption_id is not null then
    select coalesce(sum(amount), 0) into v_current_balance
    from public.coin_transactions
    where learner_id = v_learner_id;

    return query
      select v_existing_redemption_id, v_existing_transaction_id, v_current_balance, v_existing_status;
    return;
  end if;

  -- Checked INSIDE this RPC, not only by the Next.js route that calls
  -- it -- the single required safeguard while AD Astra has no funding
  -- for real voucher purchases. Defaults to false (see the previous
  -- migration); nothing in this stage flips it.
  select redemptions_enabled into v_redemptions_enabled
  from public.store_settings
  where id = 1;

  if coalesce(v_redemptions_enabled, false) is not true then
    raise exception 'STORE_CLOSED' using errcode = 'P0001';
  end if;

  case p_catalogue_item_id
    when 'kfc-r20' then
      v_provider := 'KFC'; v_rand_value := 20; v_coin_cost := 2000;
    when 'kfc-r50' then
      v_provider := 'KFC'; v_rand_value := 50; v_coin_cost := 5000;
    when 'kfc-r100' then
      v_provider := 'KFC'; v_rand_value := 100; v_coin_cost := 10000;
    when 'mrd-snackme-r20' then
      v_provider := 'Mr D SnackMe'; v_rand_value := 20; v_coin_cost := 2000;
    when 'mrd-snackme-r50' then
      v_provider := 'Mr D SnackMe'; v_rand_value := 50; v_coin_cost := 5000;
    when 'mrd-snackme-r100' then
      v_provider := 'Mr D SnackMe'; v_rand_value := 100; v_coin_cost := 10000;
    else
      raise exception 'UNKNOWN_CATALOGUE_ITEM' using errcode = 'P0001';
  end case;

  -- FIX (this migration): `status` qualified as `sr.status` -- previously
  -- bare, and therefore ambiguous against this function's own
  -- RETURNS TABLE `status` output column.
  if exists (
    select 1
    from public.store_redemptions sr
    where sr.learner_id = v_learner_id
      and sr.catalogue_item_id = p_catalogue_item_id
      and sr.status = 'pending'
  ) then
    raise exception 'ALREADY_PENDING_FOR_ITEM' using errcode = 'P0001';
  end if;

  select coalesce(sum(amount), 0) into v_current_balance
  from public.coin_transactions
  where learner_id = v_learner_id;

  v_new_balance := v_current_balance - v_coin_cost;
  if v_new_balance < 0 then
    raise exception 'INSUFFICIENT_BALANCE' using errcode = 'P0001';
  end if;

  insert into public.coin_transactions (
    learner_id, amount, transaction_type, reason, actor_type, actor_id, metadata
  ) values (
    v_learner_id, -v_coin_cost, 'store_redemption',
    v_provider || ' R' || v_rand_value || ' voucher request',
    'system', v_learner_id,
    jsonb_build_object('catalogueItemId', p_catalogue_item_id)
  )
  returning id into v_transaction_id;

  insert into public.store_redemptions (
    learner_id, catalogue_item_id, provider, rand_value, coin_cost,
    status, deduction_transaction_id, idempotency_key
  ) values (
    v_learner_id, p_catalogue_item_id, v_provider, v_rand_value, v_coin_cost,
    'pending', v_transaction_id, p_idempotency_key
  )
  returning id into v_redemption_id;

  return query select v_redemption_id, v_transaction_id, v_new_balance, 'pending'::text;
end;
$$;

revoke all on function public.request_store_redemption(text, uuid) from public;
grant execute on function public.request_store_redemption(text, uuid) to authenticated;

comment on function public.request_store_redemption is
  'Atomically (per-learner advisory-locked) deducts a catalogue item''s server-derived Coin cost from the calling learner''s own balance (resolved via auth.uid(), never a parameter) and records one pending store_redemptions row, after verifying active learner status, Store availability (store_settings.redemptions_enabled), and sufficient balance. Idempotent per (learner, idempotency key). Never overwrites or deletes existing coin_transactions rows.';

create or replace function public.admin_decline_store_redemption(
  p_redemption_id uuid,
  p_new_status text,
  p_reason text
)
returns table (
  redemption_id uuid,
  transaction_id uuid,
  new_balance integer,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid;
  v_learner_id uuid;
  v_coin_cost integer;
  v_current_status text;
  v_deduction_transaction_id uuid;
  v_existing_refund_transaction_id uuid;
  v_current_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
begin
  v_admin_id := auth.uid();
  if not exists (
    select 1
    from public.profiles
    join public.teacher_profiles
      on teacher_profiles.profile_id = profiles.id
    where profiles.auth_user_id = v_admin_id
      and profiles.role = 'teacher'
      and teacher_profiles.status = 'active'
      and teacher_profiles.is_administrator = true
  ) then
    raise exception 'ADMINISTRATOR_REQUIRED' using errcode = 'P0001';
  end if;

  if p_new_status not in ('declined', 'cancelled') then
    raise exception 'UNSUPPORTED_STATUS' using errcode = 'P0001';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  -- FIX (this migration): every column qualified as `sr.<col>` --
  -- `status` was previously bare, and therefore ambiguous against this
  -- function's own RETURNS TABLE `status` output column.
  --
  -- Row-locked for the duration of this transaction -- a second
  -- concurrent decline/refund attempt for the SAME redemption blocks
  -- here until the first commits, then fails the status check below
  -- (REDEMPTION_NOT_PENDING), so a refund can never be issued twice.
  select sr.learner_id, sr.coin_cost, sr.status, sr.deduction_transaction_id, sr.refund_transaction_id
    into v_learner_id, v_coin_cost, v_current_status, v_deduction_transaction_id,
      v_existing_refund_transaction_id
  from public.store_redemptions sr
  where sr.id = p_redemption_id
  for update;

  if v_learner_id is null then
    raise exception 'REDEMPTION_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_current_status <> 'pending' or v_existing_refund_transaction_id is not null then
    raise exception 'REDEMPTION_NOT_PENDING' using errcode = 'P0001';
  end if;

  -- Same per-learner lock key used everywhere else this ledger is
  -- written -- a refund must serialise against any other concurrent
  -- write for this exact learner too (e.g. a simultaneous admin
  -- adjustment or a new redemption request).
  perform pg_advisory_xact_lock(hashtext(v_learner_id::text));

  select coalesce(sum(amount), 0) into v_current_balance
  from public.coin_transactions
  where learner_id = v_learner_id;

  v_new_balance := v_current_balance + v_coin_cost;

  insert into public.coin_transactions (
    learner_id, amount, transaction_type, reason, actor_type, actor_id,
    reference_transaction_id, metadata
  ) values (
    v_learner_id, v_coin_cost, 'store_redemption_refund', p_reason, 'admin', v_admin_id,
    v_deduction_transaction_id, jsonb_build_object('redemptionId', p_redemption_id)
  )
  returning id into v_transaction_id;

  update public.store_redemptions
  set status = p_new_status,
      refund_transaction_id = v_transaction_id,
      reviewed_at = now(),
      reviewed_by = v_admin_id,
      updated_at = now()
  where id = p_redemption_id;

  return query select p_redemption_id, v_transaction_id, v_new_balance, p_new_status;
end;
$$;

revoke all on function public.admin_decline_store_redemption(uuid, text, text) from public;
grant execute on function public.admin_decline_store_redemption(uuid, text, text) to authenticated;

comment on function public.admin_decline_store_redemption is
  'Atomically declines or cancels a pending store_redemptions row and issues exactly one compensating store_redemption_refund coin_transactions row for its full original Coin cost, after re-verifying the caller is an active administrator. A request can only ever be refunded once (row-locked + status/refund-reference guard). Not yet exposed by any Next.js route or admin UI in Stage B.';

notify pgrst, 'reload schema';
