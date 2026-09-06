// AD ASTRA ADMINISTRATOR HUB -- COIN VIEWER, STAGE 1.
//
// The one canonical mapping from a coin_transactions.transaction_type
// database value to an administrator-friendly label. The underlying
// database value is never changed or hidden -- this is presentation
// only, exactly mirroring the badge-resolver precedent established for
// Monthly Reports (lib/reports/monthlyReportBadgeAsset.ts): a plain
// module, safe to import from a Server or Client Component, that never
// guesses a label for an unrecognised value.

export type CoinTransactionType =
  | "lesson_activity_reward"
  | "admin_adjustment"
  | "store_redemption"
  | "ad_astra_contribution"
  | "correction"
  | "competition_award"
  | "promotional_award"
  | "special_achievement";

const COIN_TRANSACTION_TYPE_LABELS: Record<CoinTransactionType, string> = {
  lesson_activity_reward: "Lesson & Activity Reward",
  admin_adjustment: "Admin Adjustment",
  store_redemption: "Store Redemption",
  ad_astra_contribution: "Ad Astra Contribution",
  correction: "Correction",
  competition_award: "Competition Award",
  promotional_award: "Promotional Award",
  special_achievement: "Special Achievement",
};

// Accepts `unknown` deliberately: a transaction_type is a database check-
// constrained value today, but this display layer must never crash or
// silently mislabel if that ever changes -- an unrecognised value falls
// back to the raw stored string, never a guessed/blank label.
export function resolveCoinTransactionTypeLabel(transactionType: unknown): string {
  if (
    typeof transactionType === "string" &&
    Object.prototype.hasOwnProperty.call(COIN_TRANSACTION_TYPE_LABELS, transactionType)
  ) {
    return COIN_TRANSACTION_TYPE_LABELS[transactionType as CoinTransactionType];
  }
  return typeof transactionType === "string" ? transactionType : "Unknown";
}
