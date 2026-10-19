-- AD Astra Store -- Stage B1 audit correction: an index for an
-- administrator review queue ("show me every pending redemption across
-- all learners"), which does not exist as a query pattern yet (Stage B
-- exposes no admin UI for this), but which every other query already in
-- this codebase's admin surfaces (e.g. Coin Management) will eventually
-- need once one is built.
--
-- Deliberately a separate, narrowly scoped migration rather than editing
-- 202610160002_store_redemptions.sql in place -- even though Stage B's
-- migrations have not yet been applied to any live database in this
-- environment, editing an earlier migration after a later one
-- (202610160003/202610160004) already references the table it creates
-- is the wrong habit to start; a new, additive migration keeps the
-- existing four in their already-reviewed, correctly-ordered state.
--
-- A plain index on `status` alone (rather than a partial index on
-- status = 'pending') is used because a future admin queue will
-- realistically also want to filter/sort by other statuses (declined,
-- cancelled, fulfilled) for an audit trail, not only 'pending' -- a
-- partial index would need to be revisited the moment that happens.
create index if not exists store_redemptions_status_idx
  on public.store_redemptions (status, requested_at desc);

notify pgrst, 'reload schema';
