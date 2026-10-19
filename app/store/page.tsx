import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Coins, History, ShoppingBag, Sparkles } from "lucide-react";
import { neueHaas } from "@/app/fonts";
import { RedemptionHistoryList } from "@/components/store/RedemptionHistoryList";
import { StoreItemCard } from "@/components/store/StoreItemCard";
import { formatAcBalanceDisplay, hasValidAcBalance } from "@/lib/store/storeBalanceDisplay";
import { STORE_CATALOGUE } from "@/lib/store/storeCatalogue";
import { getCurrentLearnerContext } from "@/lib/supabase/currentLearnerContext";
import { getLearnerRewardsSummary } from "@/lib/supabase/learnerRewardsSummary";
import { isMissingStoreRedemptionsTableError } from "@/lib/supabase/storeRedemptionErrors";
import {
  getLearnerStoreRedemptions,
  isStoreRedemptionAvailable,
  type StoreRedemptionRow,
} from "@/lib/supabase/storeRedemptions";
import { logSupabaseError } from "@/lib/supabase/errorDetails";

// AD ASTRA STORE -- STAGE A/B (catalogue, navigation, and redemption
// REQUESTS -- still never a live purchase). Mirrors app/xp-coins/page.tsx's
// own auth/error-state handling exactly: the canonical
// getCurrentLearnerContext() resolves the real learner (never a
// client-supplied id), an unsuccessful context degrades to a graceful
// inline message (no redirect("/login"), no private data ever rendered),
// and the Coin balance is read exclusively via the existing
// getLearnerRewardsSummary() -- never a second balance calculation, never
// a hardcoded number, and never a fabricated "0" when the real value
// failed to load.
//
// Stage B adds a server-side redemption-request RPC
// (request_store_redemption(), see its own migration), but
// store_settings.redemptions_enabled defaults to false and nothing here
// flips it -- this page never calls that RPC itself, never renders a
// working "Redeem" action, and never implies a request has been placed.
// Redemption history is read-only and will simply stay empty until a
// later stage both funds and opens the Store.
export const dynamic = "force-dynamic";

export default async function StorePage() {
  const context = await getCurrentLearnerContext();

  if (context.status !== "success") {
    return (
      <main className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6`}>
        <div className="mx-auto max-w-md rounded-[2rem] border border-blue-100 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-600">{context.message}</p>
          <Link href="/home" prefetch={false} className="mt-4 inline-block text-sm font-semibold text-[#508DB1]">
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  let acBalance: number | null = null;
  try {
    const summary = await getLearnerRewardsSummary(context.identity.learnerId);
    acBalance = summary.acBalance;
  } catch (error) {
    logSupabaseError("Unable to load learner rewards summary for the Store:", error);
  }

  // STAGE B1 AUDIT CORRECTION: the real server-side flag now actually
  // drives this page's "available"/"closed" messaging, rather than the
  // page only ever showing hardcoded closed text regardless of the
  // flag's real value. Fails CLOSED (false) on any load failure -- an
  // unreadable flag must never be treated as "open". Reading this flag
  // being true in the future still does NOT add a working Redeem
  // action anywhere on this page or on StoreItemCard -- that is a
  // deliberate, separate decision this correction does not make.
  let redemptionsEnabled = false;
  try {
    redemptionsEnabled = await isStoreRedemptionAvailable();
  } catch (error) {
    logSupabaseError("Unable to determine Store availability -- failing closed:", error);
  }

  // A genuine load failure is tracked SEPARATELY from "zero rows" --
  // redemptionHistoryUnavailable must never be inferred from an empty
  // redemptions array, or a real failure would render identically to
  // "you haven't requested anything yet", which is a false empty state.
  let redemptions: StoreRedemptionRow[] = [];
  let redemptionHistoryUnavailable = false;
  try {
    redemptions = await getLearnerStoreRedemptions(context.identity.learnerId);
  } catch (error) {
    redemptionHistoryUnavailable = true;
    if (isMissingStoreRedemptionsTableError(error)) {
      // Expected during Stage B pre-migration development -- logged
      // plainly (not via logSupabaseError's fuller diagnostic path,
      // which is reserved for genuinely unexpected failures) so it
      // reads as "known, pending a migration" rather than an alarm.
      console.warn(
        "Store redemption history is unavailable because the store_redemptions table has not been migrated yet.",
      );
    } else {
      // Any OTHER error must stay fully observable -- never folded into
      // the same quiet path as the expected missing-table case above.
      logSupabaseError("Unable to load learner Store redemption history:", error);
    }
  }

  return (
    <main className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-4 pb-16 sm:px-6 sm:pt-6 lg:px-8`}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 lg:max-w-6xl">
        <Link
          href="/xp-coins"
          prefetch={false}
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#508DB1]"
        >
          <ArrowLeft size={17} /> Back to XP & Coins
        </Link>

        {/* A. Premium Store hero -- a single card: store-hero.png as the
            background, with the heading/tagline overlaid top-left on a
            dark gradient for readability. Never two separate cards. */}
        <section className="relative h-48 overflow-hidden rounded-[2rem] border border-blue-100 shadow-lg sm:h-64 lg:h-80">
          <Image
            src="/images/store/store-hero.png"
            alt="AD Astra Store -- a collection of gift boxes representing the rewards you can work toward"
            fill
            sizes="(min-width: 1024px) 1152px, 100vw"
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#102A43]/90 via-[#102A43]/40 to-transparent" />
          <div className="absolute inset-0 flex flex-col items-start justify-start p-6 text-white lg:p-10">
            <h1 className="text-3xl font-extrabold lg:text-4xl">Ad Astra Store</h1>
            <p className="mt-2 text-sm font-semibold text-blue-100 lg:text-base">
              Your effort. Your rewards.
            </p>
          </div>
        </section>

        {/* B. Coin wallet summary */}
        <section className="rounded-[2rem] border border-yellow-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#FFF8E6] p-3 text-[#D9A106]">
              <Coins size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#102A43]">Your Ad Astra Coins</h2>
              <p className="text-xs font-medium text-black/50">Your current spendable balance</p>
            </div>
          </div>
          {hasValidAcBalance(acBalance) ? (
            <p className="text-4xl font-extrabold text-[#D9A106]">
              {formatAcBalanceDisplay(acBalance)}
            </p>
          ) : (
            <p className="text-sm font-semibold text-black/40">
              Unable to load your Coin balance right now.
            </p>
          )}
        </section>

        {/* C. Food & Treats catalogue */}
        <section>
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
              <ShoppingBag size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#102A43]">Food &amp; Treats</h2>
              <p className="text-xs font-medium text-black/50">
                Rewards you can work toward
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {STORE_CATALOGUE.map((item) => (
              <StoreItemCard key={item.id} item={item} acBalance={acBalance} redemptionsEnabled={redemptionsEnabled} />
            ))}
          </div>
        </section>

        {/* D. Informational reward availability section -- reflects the
            real store_settings.redemptions_enabled flag (via
            isStoreRedemptionAvailable()), never hardcoded text alone.
            Still never renders a working Redeem action either way. */}
        <section className="rounded-[2rem] border border-blue-100 bg-white p-6 text-center shadow-sm lg:p-10">
          <div className="mx-auto mb-3 inline-flex rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
            <Sparkles size={22} />
          </div>
          {redemptionsEnabled ? (
            <>
              <h2 className="text-lg font-bold text-[#102A43]">The Store Is Open -- Requests Are Coming Soon</h2>
              <p className="mx-auto mt-3 max-w-md text-sm text-black/60">
                Redemptions have been enabled server-side, but submitting a request isn&apos;t
                available in this app yet. This page will tell you as soon as it is.
                Opening the Store will also require guardian consent to be in place.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-[#102A43]">Redemptions Are Not Yet Available</h2>
              <p className="mx-auto mt-3 max-w-md text-sm text-black/60">
                The Store catalogue is here so you can see what you&apos;re working toward.
                Redemption requests, Coin deductions, and voucher delivery are not yet open.
                This page will tell you as soon as they are. Opening the Store will also
                require guardian consent to be in place, not only funding.
              </p>
            </>
          )}
        </section>

        {/* G. Redemption history -- read-only, learner-scoped */}
        <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
              <History size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#102A43]">Redemption History</h2>
              <p className="text-xs font-medium text-black/50">Your past reward requests</p>
            </div>
          </div>
          {redemptionHistoryUnavailable ? (
            <p className="rounded-2xl bg-[#F8FBFF] p-4 text-sm text-slate-500">
              Unable to load your redemption history right now.
            </p>
          ) : (
            <RedemptionHistoryList redemptions={redemptions} />
          )}
        </section>

        <p className="mx-auto max-w-md text-center text-xs text-black/40">
          KFC and Mr D are independent third-party reward providers. AD Astra is not
          affiliated with or endorsed by either brand.
        </p>
      </div>
    </main>
  );
}
