-- AD Astra Administrator Coin Management -- Stage 2: controlled manual
-- Coin adjustments.
--
-- public.coin_transactions remains the sole, immutable, append-only
-- source of truth (no cached/materialised balance column exists or is
-- added here). This migration adds exactly one thing: a security-definer
-- RPC that makes "read the current balance, then insert a new signed
-- transaction, never letting a deduction take the learner below 0 AC"
-- genuinely atomic under concurrency -- not just a best-effort
-- application-level read-then-insert.
--
-- Why a database function rather than application code: two concurrent
-- deduction requests for the same learner could each read the
-- pre-deduction balance, both see it as sufficient, and both insert --
-- an overdraft neither request could have detected alone. A
-- transaction-scoped Postgres advisory lock keyed on the learner id
-- serialises concurrent adjustment attempts for that ONE learner (a
-- second concurrent call blocks until the first call's transaction
-- commits or rolls back, so it always sees the first call's effect)
-- without taking any lock on unrelated learners' adjustments.
--
-- This function is SECURITY DEFINER (it must read every learner's full
-- ledger to compute a balance, which RLS would otherwise restrict) and is
-- granted to `authenticated` -- so it re-verifies the caller is a genuine,
-- active administrator ITSELF, exactly mirroring
-- can_manage_subject_reports's own auth.uid() + teacher_profiles join
-- (202609010001_monthly_reports.sql). Without this internal check,
-- granting EXECUTE to `authenticated` would let ANY signed-in user adjust
-- ANY learner's balance merely by calling the RPC directly -- the
-- application route's own authorizeAdministrator() check is necessary but
-- not sufficient on its own once a security-definer function exists.
--
-- actor_id is deliberately never a parameter: it is always auth.uid()
-- itself, resolved server-side inside the function from the caller's own
-- session -- an admin adjustment can never be attributed to a
-- caller-asserted identity.
create or replace function public.admin_adjust_learner_coins(
  p_learner_id uuid,
  p_amount integer,
  p_transaction_type text,
  p_reason text,
  p_reference_transaction_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  transaction_id uuid,
  new_balance integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
begin
  if not exists (
    select 1
    from public.profiles
    join public.teacher_profiles
      on teacher_profiles.profile_id = profiles.id
    where profiles.auth_user_id = (select auth.uid())
      and profiles.role = 'teacher'
      and teacher_profiles.status = 'active'
      and teacher_profiles.is_administrator = true
  ) then
    raise exception 'ADMINISTRATOR_REQUIRED' using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount = 0 then
    raise exception 'ZERO_AMOUNT' using errcode = 'P0001';
  end if;

  -- Manual adjustments may only ever create one of these five types --
  -- lesson_activity_reward, store_redemption, and ad_astra_contribution
  -- belong to their own separate system workflows and must never be
  -- creatable through this administrator path, even by a direct RPC call
  -- that bypasses the application route's own (identical) restriction.
  if p_transaction_type not in (
    'admin_adjustment', 'correction', 'competition_award',
    'promotional_award', 'special_achievement'
  ) then
    raise exception 'UNSUPPORTED_TRANSACTION_TYPE' using errcode = 'P0001';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  -- Serialises concurrent adjustment attempts for THIS learner only --
  -- released automatically at transaction end (xact-scoped), never held
  -- across the function call boundary.
  perform pg_advisory_xact_lock(hashtext(p_learner_id::text));

  select coalesce(sum(amount), 0) into v_current_balance
  from public.coin_transactions
  where learner_id = p_learner_id;

  v_new_balance := v_current_balance + p_amount;

  if v_new_balance < 0 then
    raise exception 'INSUFFICIENT_BALANCE' using errcode = 'P0001';
  end if;

  insert into public.coin_transactions (
    learner_id, amount, transaction_type, reason, actor_type, actor_id,
    reference_transaction_id, metadata
  ) values (
    p_learner_id, p_amount, p_transaction_type, p_reason, 'admin', auth.uid(),
    p_reference_transaction_id, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_transaction_id;

  return query select v_transaction_id, v_new_balance;
end;
$$;

revoke all on function public.admin_adjust_learner_coins(uuid, integer, text, text, uuid, jsonb) from public;
grant execute on function public.admin_adjust_learner_coins(uuid, integer, text, text, uuid, jsonb) to authenticated;

comment on function public.admin_adjust_learner_coins is
  'Atomically (per-learner advisory-locked) inserts one signed administrator Coin adjustment/correction transaction after re-verifying the caller is an active administrator and that the resulting balance would not go below 0. Never overwrites or deletes existing coin_transactions rows.';

notify pgrst, 'reload schema';
