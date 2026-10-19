import type { StoreRedemptionRow } from "@/lib/supabase/storeRedemptions";

// Mirrors components/rewards/CoinTransactionList.tsx's own row-list
// shape/empty-state pattern -- a second, separate presentation of the
// same canonical data model (store_redemptions), never a second data
// source. Read-only: there is no action in this list, since Stage B
// exposes no decline/cancel/refund UI yet.
export function RedemptionHistoryList({
  redemptions,
}: {
  redemptions: StoreRedemptionRow[];
}) {
  if (redemptions.length === 0) {
    return (
      <p className="rounded-2xl bg-[#F8FBFF] p-4 text-sm text-slate-500">
        You have not requested any rewards yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-blue-50">
      {redemptions.map((redemption) => (
        <li
          key={redemption.id}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#102A43]">
              {redemption.provider} R{redemption.rand_value}
            </p>
            <p className="text-xs font-medium text-slate-500">
              {new Date(redemption.requested_at).toLocaleDateString("en-ZA", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-[#D9A106]">
              {redemption.coin_cost.toLocaleString("en-US")} AC
            </p>
            <p className="text-xs font-semibold capitalize text-slate-500">
              {redemption.status}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
