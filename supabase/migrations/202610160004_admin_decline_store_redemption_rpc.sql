-- AD Astra Store -- Stage B: the administrative decline/cancel-and-refund
-- operation. Provided now so a future stage's admin review workflow has
-- an atomic, safe primitive to call -- Stage B deliberately does NOT
-- build or expose any admin UI or Next.js route for this yet (there is
-- nothing to review: redemptions are closed, so no real request can
-- exist outside of manual/testing use).
--
-- Declining or cancelling a request and refunding its Coins happen
-- together, in the one call, rather than as two separate steps -- this
-- is what prevents a request from ever being marked declined/cancelled
-- without its Coins actually being returned (or vice versa: refunded
-- without the status changing).
--
-- CALLING CONVENTION: exactly like request_store_redemption(), a future
-- caller must use the ADMINISTRATOR'S OWN request-scoped Supabase client
-- (carrying their real session), never the service-role admin client --
-- this function resolves the acting administrator from auth.uid() and
-- re-verifies their administrator status itself, mirroring
-- admin_adjust_learner_coins()'s own self-contained check.
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

  -- Row-locked for the duration of this transaction -- a second
  -- concurrent decline/refund attempt for the SAME redemption blocks
  -- here until the first commits, then fails the status check below
  -- (REDEMPTION_NOT_PENDING), so a refund can never be issued twice.
  select learner_id, coin_cost, status, deduction_transaction_id, refund_transaction_id
    into v_learner_id, v_coin_cost, v_current_status, v_deduction_transaction_id,
      v_existing_refund_transaction_id
  from public.store_redemptions
  where id = p_redemption_id
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
