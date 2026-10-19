import { ChevronDown, Gift, Lock, Smartphone, Store as StoreIcon } from "lucide-react";
import type { StoreCatalogueItem } from "@/lib/store/storeCatalogue";
import { canAffordItem, formatAcBalanceDisplay, hasValidAcBalance } from "@/lib/store/storeBalanceDisplay";

// Stage A/B product card -- display only.
//
// Official KFC South Africa and Mr D logo usage was investigated for this
// card (see the Stage A brand-logo-enhancement report) but no official
// brand-asset page or licence was found granting a third party like AD
// Astra permission to display either mark -- both brand owners' standard
// position is that logo use requires direct written permission, which AD
// Astra does not currently have. No real logo image is used here as a
// result, per that investigation's own "leave as a pending asset, use the
// styled text fallback" instruction. A later stage may add a real
// `logoSrc`/<Image> once usage is actually authorised -- this file is not
// the place to add that speculatively ahead of time.
//
// Instead, each card uses an original, AD Astra-styled wordmark badge
// (CSS + lucide-react icon only, never a fetched/third-party image), with
// the provider name always rendered as plain text. Redemption is always
// disabled in Stage B too -- this component has no onClick/action prop,
// no fetch call, and no form at all, so a later stage (once the Store is
// actually funded and store_settings.redemptions_enabled is turned on)
// must deliberately add a real submission path rather than this card
// silently gaining a working "Redeem" button. The <details> disclosure
// below is pure, native, JS-free HTML -- it reveals more honest detail
// (balance comparison, redemption conditions, Store availability), never
// a request action.
export function StoreItemCard({
  item,
  acBalance,
  redemptionsEnabled,
}: {
  item: StoreCatalogueItem;
  // null when the balance failed to load independently of the catalogue
  // itself -- the card still renders, just without a balance comparison,
  // rather than hiding the item over an unrelated failure. Formatting and
  // the affordability comparison are delegated entirely to
  // lib/store/storeBalanceDisplay.ts's pure helpers, which guard with
  // `typeof === "number"` rather than `!== null` -- the declared type
  // promises number|null, but a caller mistake (a missing prop, a future
  // refactor that forgets to pass it) could still hand this component
  // `undefined` at runtime despite TypeScript, and `!== null` alone does
  // not catch that (undefined !== null is also true).
  acBalance: number | null;
  // STAGE B1 AUDIT CORRECTION: the real store_settings.redemptions_enabled
  // flag (via isStoreRedemptionAvailable(), fails closed to false on any
  // read failure in app/store/page.tsx), used only to make the
  // "Store availability" line below honest -- it does NOT unlock the
  // disabled action beneath it. That stays permanently disabled in
  // Stage B regardless of this value; wiring up a real submission path
  // is a deliberate, separate decision for a later stage.
  redemptionsEnabled: boolean;
}) {
  const isKfc = item.provider === "KFC";
  const hasValidBalance = hasValidAcBalance(acBalance);
  const hasEnoughCoins = canAffordItem(acBalance, item.coinCost);

  return (
    <article className="flex flex-col overflow-hidden rounded-[1.75rem] border border-blue-100 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div
        className={`relative flex h-32 flex-col items-center justify-center gap-2 ${
          isKfc
            ? "bg-gradient-to-br from-[#102A43] to-[#1C3A5E]"
            : "bg-gradient-to-br from-[#102A43] to-[#2B4A6B]"
        }`}
      >
        <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 shadow-sm">
          <Gift size={18} className={isKfc ? "text-[#E4002B]" : "text-[#00B2A9]"} />
          <p
            className={`text-sm font-extrabold uppercase tracking-[0.04em] ${
              isKfc ? "text-[#E4002B]" : "text-[#00B2A9]"
            }`}
          >
            {item.provider}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-base font-bold text-[#102A43]">{item.title}</h3>
          <p className="mt-1 text-xs text-black/60">{item.description}</p>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-[#FFF8E6] px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-black/50">
            Value
          </span>
          <span className="text-sm font-bold text-[#102A43]">R{item.randValue}</span>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-[#F8FBFF] px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-black/50">
            Coin price
          </span>
          <span className="text-sm font-bold text-[#D9A106]">
            {item.coinCost.toLocaleString("en-US")} AC
          </span>
        </div>

        <div className="flex items-start gap-2 text-xs text-black/50">
          {item.redemptionMethod === "app_claim" ? (
            <Smartphone size={14} className="mt-0.5 shrink-0" />
          ) : (
            <StoreIcon size={14} className="mt-0.5 shrink-0" />
          )}
          <span>{item.fulfilmentNote}</span>
        </div>

        <details className="group rounded-2xl border border-blue-100 bg-[#F8FBFF] px-3 py-2 text-xs">
          <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-[#508DB1]">
            Redemption details
            <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 space-y-1.5 text-black/60">
            <p>
              Your balance:{" "}
              <span className="font-semibold text-[#102A43]">
                {formatAcBalanceDisplay(acBalance)}
              </span>
              {hasValidBalance && (
                <span className="ml-1">
                  ({hasEnoughCoins ? "enough for this reward" : "not yet enough for this reward"})
                </span>
              )}
            </p>
            <p>Redemption method: {item.redemptionMethod === "app_claim" ? "Claimed in the Mr D app" : "Redeemed in-store"}</p>
            <p>
              Store availability:{" "}
              {redemptionsEnabled
                ? "Open -- but submitting a request isn't available in this app yet."
                : "Closed -- redemption requests are not yet accepted."}
            </p>
          </div>
        </details>

        <div className="mt-auto flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-[#F8FBFF] py-3 text-sm font-semibold text-black/40">
          <Lock size={15} />
          Redemptions Coming Soon
        </div>
      </div>
    </article>
  );
}
