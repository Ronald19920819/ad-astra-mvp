-- AD Astra Store -- Stage B: a narrowly scoped refund transaction type.
--
-- Store redemption refunds must never be recorded as 'correction' or
-- 'admin_adjustment' -- both are generic, unscoped categories already
-- used for other purposes, and conflating a Store refund with either
-- would make a future Coin statement unable to distinguish "an
-- administrator corrected a mistake" from "a voucher request was
-- declined/cancelled and its Coins were returned." This migration adds
-- exactly one new, dedicated enum value for that single purpose.
alter table public.coin_transactions
  drop constraint if exists coin_transactions_transaction_type_check;

alter table public.coin_transactions
  add constraint coin_transactions_transaction_type_check
  check (
    transaction_type in (
      'lesson_activity_reward',
      'admin_adjustment',
      'store_redemption',
      'ad_astra_contribution',
      'correction',
      'competition_award',
      'promotional_award',
      'special_achievement',
      'store_redemption_refund'
    )
  );

-- A refund must always reference the original deduction it reverses --
-- exactly the same invariant already enforced for 'correction' rows.
alter table public.coin_transactions
  drop constraint if exists coin_transactions_store_refund_reference_check;

alter table public.coin_transactions
  add constraint coin_transactions_store_refund_reference_check
  check (
    transaction_type <> 'store_redemption_refund'
    or reference_transaction_id is not null
  );

notify pgrst, 'reload schema';
