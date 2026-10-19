-- AD Astra Store -- Stage B: the one atomic write path for a learner's
-- own Store redemption request. Immediately deducts the item's Coin
-- cost from the learner's canonical balance (SUM(amount) over
-- coin_transactions) and records the request, or fails entirely with no
-- partial effect.
--
-- CALLING CONVENTION (important, and different from
-- admin_adjust_learner_coins()): this function must be called through
-- the LEARNER'S OWN request-scoped Supabase client (the one carrying
-- their real session cookie/JWT via createSupabaseRequestClient()),
-- never the service-role admin client. It resolves the learner entirely
-- from auth.uid() -- there is no p_learner_id parameter at all, so a
-- client can never submit a request "as" another learner. A service-role
-- call carries no end-user JWT "sub" claim, so auth.uid() would resolve
-- to null inside this function and the ACTIVE_LEARNER_REQUIRED check
-- below would reject every call -- that is a deliberate fail-closed
-- behaviour, not a bug, but it does mean the application code calling
-- this RPC must use the request-scoped client specifically (see
-- lib/supabase/storeRedemptions.ts's own comment for the Next.js side of
-- this).
--
-- Concurrency/atomicity mirrors admin_adjust_learner_coins() exactly:
-- SECURITY DEFINER (needed to read the learner's full ledger, which RLS
-- would otherwise restrict, and to write a row the learner has no
-- insert policy for), search_path locked to '', and the SAME per-learner
-- advisory lock key (hashtext(learner_id::text)) -- so a redemption
-- request and a concurrent admin Coin adjustment for the same learner
-- serialise against each other too, never just against other redemption
-- requests.
--
-- Price/provider/value are a server-side allowlist hardcoded below,
-- deliberately duplicating lib/store/storeCatalogue.ts's six Stage A
-- items rather than trusting any client-supplied price or querying a
-- catalogue table (none exists yet -- see the previous migration's
-- comment). Keeping these two in sync is a manual step for whoever next
-- changes the catalogue; a future stage that makes the catalogue
-- admin-editable should migrate this allowlist into a real table and
-- have this function select from it instead.
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

  -- STAGE B1 AUDIT CORRECTION: a learner submitting a genuinely NEW
  -- idempotency key for an item they already have a 'pending' request
  -- for would otherwise reach the final INSERT below and hit
  -- store_redemptions_one_pending_per_item_idx's unique-violation
  -- (23505) unhandled -- the whole transaction still rolls back cleanly
  -- (no orphaned deduction; atomicity was never actually broken), but
  -- the caller received a raw, undocumented Postgres error rather than
  -- one of this function's own clean codes. Checked here explicitly,
  -- while still holding the per-learner advisory lock acquired above,
  -- so there is no race between this check and the eventual insert --
  -- the unique index remains in place below as a defence-in-depth
  -- backstop, not the only thing preventing a duplicate.
  if exists (
    select 1
    from public.store_redemptions
    where learner_id = v_learner_id
      and catalogue_item_id = p_catalogue_item_id
      and status = 'pending'
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

notify pgrst, 'reload schema';
