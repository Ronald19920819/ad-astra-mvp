-- AD Astra Coin ledger (Stage 3): an immutable, append-only, signed
-- transaction log. A learner's Coin balance is SUM(amount) over their own
-- rows -- there is deliberately no separate mutable coin_balance column
-- anywhere. Every Coin movement (automatic lesson+activity pair rewards
-- now; admin adjustments, Store redemptions, AD Astra Contribution
-- donations, and corrections/reversals later) is exactly one row here.
--
-- This migration creates the ledger table and its constraints/RLS only.
-- No historical rows are inserted by this migration -- Stage 3 explicitly
-- previews what a backfill would look like without writing it.
create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users(id) on delete restrict,

  -- Signed whole-Coin amount. Zero is never a valid transaction: a
  -- non-qualifying reward calculation (below 50%, more than 4 days late,
  -- etc.) simply never creates a row, rather than creating a meaningless
  -- 0-amount one.
  amount integer not null check (amount <> 0),

  transaction_type text not null check (
    transaction_type in (
      'lesson_activity_reward',
      'admin_adjustment',
      'store_redemption',
      'ad_astra_contribution',
      'correction',
      'competition_award',
      'promotional_award',
      'special_achievement'
    )
  ),

  -- Attribution -- populated where applicable to the transaction_type.
  subject_id uuid null references public.subjects(id) on delete set null,
  lesson_id uuid null references public.lessons(id) on delete set null,
  activity_id uuid null references public.activities(id) on delete set null,
  activity_submission_id uuid null references public.activity_submissions(id) on delete set null,

  -- A correction/reversal points back at the transaction it corrects, so
  -- the original row is never deleted or overwritten -- the ledger stays
  -- append-only and the full history remains inspectable.
  reference_transaction_id uuid null references public.coin_transactions(id) on delete set null,

  actor_type text not null default 'system'
    check (actor_type in ('system', 'admin', 'teacher')),
  actor_id uuid null references auth.users(id) on delete set null,

  reason text null check (reason is null or length(reason) <= 500),

  -- Frozen calculation detail for automatic pair rewards (teacher-final
  -- percentage, base/bonus/late-deduction breakdown, frozen mark
  -- denominator, due date, days late, etc.) so the transaction remains
  -- fully explainable even if the underlying activity is edited later.
  -- Also used to carry admin-adjustment reasons and future Store/order
  -- references without needing new columns for every transaction_type.
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  -- An automatic pair reward must always carry its full attribution.
  check (
    transaction_type <> 'lesson_activity_reward'
    or (
      activity_submission_id is not null
      and lesson_id is not null
      and activity_id is not null
      and subject_id is not null
    )
  ),

  -- A correction must always reference what it corrects.
  check (
    transaction_type <> 'correction'
    or reference_transaction_id is not null
  )
);

-- Idempotency guarantee (locked requirement): the same learner+submission
-- can never receive more than one automatic pair reward, enforced at the
-- database level -- not merely by application logic. Scoped (partial
-- index) to lesson_activity_reward only, so corrections/admin
-- adjustments/etc. referencing the same submission later are never
-- blocked by this constraint.
create unique index if not exists coin_transactions_pair_reward_idempotency_idx
  on public.coin_transactions (learner_id, activity_submission_id)
  where transaction_type = 'lesson_activity_reward';

create index if not exists coin_transactions_learner_idx
  on public.coin_transactions (learner_id, created_at desc);

create index if not exists coin_transactions_reference_idx
  on public.coin_transactions (reference_transaction_id)
  where reference_transaction_id is not null;

alter table public.coin_transactions enable row level security;

-- Learners may read their own transaction history (needed by a future
-- Coin statement page) but can never write to it -- no insert/update/
-- delete policy exists for `authenticated`, so only the service role
-- (used exclusively by server-side code such as
-- lib/supabase/coinLedger.ts) can ever create or touch a row.
create policy "Learners can read their own coin transactions"
  on public.coin_transactions
  for select
  to authenticated
  using ((select auth.uid()) = learner_id);

revoke all on table public.coin_transactions from anon;
grant select on table public.coin_transactions to authenticated;

comment on table public.coin_transactions is
  'Immutable AD Astra Coin ledger. Every Coin movement is one signed, append-only row; balance = SUM(amount). Never updated or deleted -- corrections use a new row referencing the original via reference_transaction_id.';

notify pgrst, 'reload schema';
