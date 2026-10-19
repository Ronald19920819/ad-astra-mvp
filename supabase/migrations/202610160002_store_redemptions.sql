-- AD Astra Store -- Stage B: redemption requests and a server-controlled
-- Store availability switch.
--
-- Two tables, intentionally minimal:
--
-- 1. public.store_settings -- a one-row singleton holding
--    redemptions_enabled, checked by request_store_redemption() itself
--    (not merely by a Next.js route) before any Coin is ever deducted.
--    Defaults to false: AD Astra does not currently have funding for
--    real voucher purchases, so live redemption requests must stay
--    closed until a later stage deliberately flips this value. No
--    toggle UI is built in this migration or Stage B's application code
--    -- changing it today requires a direct database update by someone
--    with service-role access, which is itself the point: there is no
--    client-reachable path to opening the Store yet.
--
-- 2. public.store_redemptions -- one immutable-once-decided row per
--    redemption request. The Coin deduction itself is NOT stored here;
--    it is the existing coin_transactions ledger (transaction_type =
--    'store_redemption') that this row's deduction_transaction_id points
--    at -- there is still only ONE Coin ledger and ONE way to compute a
--    balance (SUM(amount) over coin_transactions). This table exists
--    purely to track a request's lifecycle (pending/approved/fulfilled/
--    declined/cancelled) and link it to its deduction/refund ledger
--    rows -- it is never itself summed for a balance.
--
-- Deliberately NOT created here: a store_catalogue_items table. The six
-- Stage A products remain a static TypeScript config
-- (lib/store/storeCatalogue.ts); the redemption RPC (next migration)
-- re-derives provider/value/Coin cost from its own server-side allowlist
-- that mirrors that config, rather than trusting a client-supplied price
-- OR querying a database table that doesn't yet exist. See that
-- migration's own comment for why, and for what keeping the two in sync
-- requires.
create table if not exists public.store_settings (
  id integer primary key default 1,
  redemptions_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint store_settings_singleton check (id = 1)
);

insert into public.store_settings (id, redemptions_enabled)
values (1, false)
on conflict (id) do nothing;

alter table public.store_settings enable row level security;

-- No select/insert/update policy exists for `authenticated` or `anon` --
-- only service-role code (e.g. the Store page, reading this purely for
-- display) and the SECURITY DEFINER redemption RPC (which bypasses RLS
-- by design) can ever read or write this table. A future stage that
-- lets an administrator toggle this value will add its own RPC, exactly
-- mirroring admin_adjust_learner_coins()'s own self-contained
-- authorization check, rather than a direct table-level policy.
revoke all on table public.store_settings from anon, authenticated;

comment on table public.store_settings is
  'Singleton Store-wide settings. redemptions_enabled defaults to false and is checked inside request_store_redemption() itself -- the catalogue stays visible regardless of this flag.';

create table if not exists public.store_redemptions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users(id) on delete restrict,

  -- Matches a lib/store/storeCatalogue.ts STORE_CATALOGUE[].id exactly --
  -- intentionally a plain text slug, not a foreign key, since the
  -- catalogue is not (yet) a database table.
  catalogue_item_id text not null,

  -- A snapshot of the catalogue item's identity/price AT REQUEST TIME --
  -- never re-read from the live config later, so a future catalogue
  -- price change can never retroactively alter what an already-submitted
  -- request cost.
  provider text not null check (provider in ('KFC', 'Mr D SnackMe')),
  rand_value integer not null check (rand_value > 0),
  coin_cost integer not null check (coin_cost > 0),

  status text not null default 'pending'
    check (status in ('pending', 'approved', 'fulfilled', 'declined', 'cancelled')),

  requested_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users(id) on delete set null,

  -- The deduction always exists (Coins are deducted immediately on
  -- request, per this stage's locked business rule) -- not nullable.
  deduction_transaction_id uuid not null references public.coin_transactions(id) on delete restrict,
  -- Only ever populated once, by the (not yet exposed) administrative
  -- decline/cancel-and-refund operation.
  refund_transaction_id uuid null references public.coin_transactions(id) on delete restrict,

  -- Caller-supplied, one UUID per distinct submission attempt -- lets
  -- request_store_redemption() recognise a retried call (double-click,
  -- client retry, network blip) and return the original result instead
  -- of creating a second request/deduction. Enforced below at the
  -- database level, not merely inside the function.
  idempotency_key uuid not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A refund can only ever exist once the request has actually left
  -- 'pending' toward a declined/cancelled outcome -- an approved/
  -- fulfilled request must never carry a refund reference.
  check (
    refund_transaction_id is null
    or status in ('declined', 'cancelled')
  ),
  check (
    (reviewed_at is null and reviewed_by is null)
    or reviewed_at is not null
  )
);

-- A retried submission with the same key can never create a second row
-- for this learner.
create unique index if not exists store_redemptions_idempotency_idx
  on public.store_redemptions (learner_id, idempotency_key);

-- A learner may not have two simultaneously open ("pending") requests
-- for the exact same catalogue item -- a genuinely new request for that
-- item can only be submitted once the earlier one has left 'pending'.
create unique index if not exists store_redemptions_one_pending_per_item_idx
  on public.store_redemptions (learner_id, catalogue_item_id)
  where status = 'pending';

create index if not exists store_redemptions_learner_idx
  on public.store_redemptions (learner_id, requested_at desc);

alter table public.store_redemptions enable row level security;

-- Learners may read their own redemption history (Stage B's "Redemption
-- History" section) but can never write to it directly -- no insert/
-- update/delete policy exists for `authenticated`, so only the
-- SECURITY DEFINER RPCs (which bypass RLS by design and re-verify
-- authorization themselves) can ever create or change a row. This
-- mirrors coin_transactions' own read-only-to-owner policy exactly.
create policy "Learners can read their own redemption requests"
  on public.store_redemptions
  for select
  to authenticated
  using ((select auth.uid()) = learner_id);

revoke all on table public.store_redemptions from anon;
grant select on table public.store_redemptions to authenticated;

comment on table public.store_redemptions is
  'One row per Store voucher redemption request. Coins are deducted immediately via coin_transactions (transaction_type=store_redemption) at request time; deduction_transaction_id links to that row. A decline/cancellation issues a compensating store_redemption_refund transaction, referenced by refund_transaction_id. Never itself summed for a balance -- coin_transactions remains the sole ledger.';

notify pgrst, 'reload schema';
