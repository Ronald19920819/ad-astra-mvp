import { neueHaas } from "@/app/fonts";
import Image from "next/image";
import { Rajdhani, Shadows_Into_Light } from "next/font/google";

const ShadowsIntoLight = Shadows_Into_Light({
  weight: "400",
  subsets: ["latin"],
});

// Reserved for the Reward System header identity (XP now, Coins directly
// beneath it in a later stage) -- kept local to this component, matching
// this file's own existing pattern for a single-use Google font
// (ShadowsIntoLight above) rather than centralizing into app/fonts.ts.
const rajdhani = Rajdhani({
  weight: "600",
  subsets: ["latin"],
});

export default function HeroBanner({
  learnerName,
  xpTotal,
  acBalance,
}: {
  learnerName: string;
  // null/undefined = don't render the XP display at all (profile
  // unavailable or the canonical reader failed) -- never flashes a fake
  // 0 XP. This value must come from the canonical
  // lib/supabase/learnerXpReader.ts::getLearnerXpSummary reader server-side;
  // this component never calculates it.
  xpTotal?: number | null;
  // null/undefined = don't render the AC display (genuine load failure --
  // e.g. the coin_transactions table/migration isn't live yet -- distinct
  // from a real, confirmed-empty ledger, which resolves to the number 0
  // and DOES render "0 AC"). This value must come from the canonical
  // lib/supabase/coinLedger.ts::getLearnerCoinBalance reader server-side;
  // this component never calculates or estimates it.
  acBalance?: number | null;
}) {
  const formattedXp =
    typeof xpTotal === "number" ? new Intl.NumberFormat("en-US").format(xpTotal) : null;
  const formattedAc =
    typeof acBalance === "number" ? new Intl.NumberFormat("en-US").format(acBalance) : null;

  return (
    <div
      className="relative mb-5 h-[260px] w-full overflow-hidden rounded-[2rem] border border-blue-100 bg-black shadow-lg lg:h-[300px] xl:h-[320px]"
      style={{
        backgroundImage: "url('/hero-banner.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />

      <div className="relative z-10 flex h-full flex-col p-6 pt-3 lg:p-8 lg:pt-5">
        <div className="mb-4 -mt-4 flex items-center gap-4 lg:mb-6">
          <Image
            src="/ad_astra_logo.png"
            alt="AD Astra Logo"
            width={70}
            height={70}
            unoptimized
            className="bg-transparent"
          />

          <Image
            src="/ad_astra_wordmark.png"
            alt="AD ASTRA"
            width={210}
            height={55}
            priority
            className="h-auto w-[210px] lg:w-[240px]"
          />
        </div>

        <h1
          className={`${ShadowsIntoLight.className} text-white leading-none`}
          style={{
            fontSize: "30px",
            fontWeight: 400,
          }}
        >
          {learnerName}
        </h1>

        <div
          style={{
            marginTop: "2px",
            marginLeft: "30px",
            width: "120px",
            height: "6px",
            background: "#508db1",
            borderRadius: "50px 15px 50px 15px",
            opacity: 0.4,
          }}
        />

        {formattedXp && (
          <>
            {/* Mobile: a compact horizontal stats row in normal document
                flow, directly beneath the name/divider and above HOME
                DASHBOARD -- keeps both values fully visible at narrow
                widths and clear of the wordmark, which the old absolute
                top-right corner placement could collide with. Desktop
                (lg:) switches back to absolute positioning in the hero's
                open centre space, reproducing the original vertically-
                stacked look exactly -- source position no longer matters
                there since lg:absolute removes it from flow either way.
                Typography only -- no card/border/background, per spec. */}
            <div
              className="pointer-events-none z-10 mt-3 flex flex-row flex-wrap items-baseline gap-x-5 gap-y-1 lg:absolute lg:left-[57%] lg:top-1/2 lg:mt-0 lg:block lg:-translate-y-1/2 lg:gap-x-0 lg:text-left"
              aria-hidden="true"
            >
              <div className="flex items-baseline gap-x-1.5 lg:block lg:gap-x-0">
                <span
                  className={`${rajdhani.className} block text-2xl leading-none lg:text-5xl xl:text-6xl`}
                  style={{
                    fontWeight: 600,
                    color: "#EAF6FF",
                    textShadow: "0 0 14px rgba(148, 210, 255, 0.35)",
                  }}
                >
                  {formattedXp}
                </span>
                <span
                  className={`${rajdhani.className} block text-[11px] leading-none tracking-[0.14em] lg:mt-0.5 lg:text-base`}
                  style={{
                    fontWeight: 600,
                    color: "#BFE3FF",
                    textShadow: "0 0 10px rgba(148, 210, 255, 0.3)",
                  }}
                >
                  XP
                </span>
              </div>

              {formattedAc && (
                <div className="flex items-baseline gap-x-1.5 lg:mt-3 lg:block lg:gap-x-0">
                  {/* AC group: warm gold instead of icy blue keeps the two
                      rewards visually distinct while sharing the same
                      Rajdhani identity. Desktop spacing from the XP group
                      above (lg:mt-3) matches the original stacked layout. */}
                  <span
                    className={`${rajdhani.className} block text-xl leading-none lg:text-3xl xl:text-4xl`}
                    style={{
                      fontWeight: 600,
                      color: "#E8C989",
                      textShadow: "0 0 12px rgba(212, 167, 89, 0.35)",
                    }}
                  >
                    {formattedAc}
                  </span>
                  <span
                    className={`${rajdhani.className} block text-[10px] leading-none tracking-[0.14em] lg:mt-0.5 lg:text-sm`}
                    style={{
                      fontWeight: 600,
                      color: "#C9A868",
                      textShadow: "0 0 8px rgba(212, 167, 89, 0.3)",
                    }}
                  >
                    AC
                  </span>
                </div>
              )}
            </div>
            {/* Real accessible names for assistive tech; the visual
                number/label pairs above are hidden from the a11y tree via
                aria-hidden so nothing is announced twice. */}
            <span className="sr-only">{`${formattedXp} experience points`}</span>
            {formattedAc && <span className="sr-only">{`${formattedAc} Ad Astra Coins`}</span>}
          </>
        )}

        <p
          className={`${neueHaas.className} uppercase tracking-[0.15em]`}
          style={{
            color: "#ffffff",
            fontSize: "20px",
            fontWeight: 500,
            marginTop: "8px",
          }}
        >
          Home Dashboard
        </p>
      </div>
    </div>
  );
}