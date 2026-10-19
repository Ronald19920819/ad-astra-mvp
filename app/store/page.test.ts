import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// app/store/page.tsx transitively imports "server-only" (via
// getCurrentLearnerContext / getLearnerRewardsSummary), so per this
// codebase's established precedent (see app/xp-coins/page.tsx's own
// equivalent, untested-directly server component) it cannot be invoked
// directly in a plain node:test run. These tests verify the real source
// directly.

const SOURCE = readFileSync("app/store/page.tsx", "utf8");

test("learner identity is resolved via the canonical getCurrentLearnerContext(), never a client-supplied id", () => {
  assert.match(
    SOURCE,
    /import \{ getCurrentLearnerContext \} from "@\/lib\/supabase\/currentLearnerContext";/,
  );
  assert.match(SOURCE, /const context = await getCurrentLearnerContext\(\);/);
});

test("an unsuccessful learner context renders a graceful inline message, never private learner data, and never a redirect", () => {
  assert.match(SOURCE, /if \(context\.status !== "success"\) \{/);
  assert.match(SOURCE, /\{context\.message\}/);
  assert.doesNotMatch(SOURCE, /\n\s*redirect\(/);
});

test("the Coin balance is read exclusively via the existing getLearnerRewardsSummary(), never a second balance calculation", () => {
  assert.match(
    SOURCE,
    /import \{ getLearnerRewardsSummary \} from "@\/lib\/supabase\/learnerRewardsSummary";/,
  );
  assert.match(SOURCE, /await getLearnerRewardsSummary\(context\.identity\.learnerId\);/);
  assert.doesNotMatch(SOURCE, /\.from\("coin_transactions"\)/);
  assert.doesNotMatch(SOURCE, /\.reduce\(/);
});

test("an unavailable Coin balance renders an honest unavailable message, never a fabricated zero -- guarded via the shared hasValidAcBalance()/formatAcBalanceDisplay() helpers, not a bare !== null check", () => {
  assert.match(
    SOURCE,
    /import \{ formatAcBalanceDisplay, hasValidAcBalance \} from "@\/lib\/store\/storeBalanceDisplay";/,
  );
  assert.match(SOURCE, /hasValidAcBalance\(acBalance\) \? \(/);
  assert.match(SOURCE, /Unable to load your Coin balance right now\./);
  assert.doesNotMatch(SOURCE, /acBalance !== null/);
});

test("the catalogue is rendered via a map over the shared static STORE_CATALOGUE, never hand-listed or re-defined in this file", () => {
  assert.match(
    SOURCE,
    /import \{ STORE_CATALOGUE \} from "@\/lib\/store\/storeCatalogue";/,
  );
  assert.match(SOURCE, /STORE_CATALOGUE\.map\(\(item\) =>/);
  assert.doesNotMatch(SOURCE, /coinCost: \d/);
  assert.match(
    SOURCE,
    /<StoreItemCard key=\{item\.id\} item=\{item\} acBalance=\{acBalance\} redemptionsEnabled=\{redemptionsEnabled\} \/>/,
  );
});

test("Stage B1 audit correction: Store availability is read from the real isStoreRedemptionAvailable() flag, failing CLOSED (false) on any load failure -- never hardcoded true and never left undetermined", () => {
  assert.match(
    SOURCE,
    /import \{\s*\n\s*getLearnerStoreRedemptions,\s*\n\s*isStoreRedemptionAvailable,\s*\n\s*type StoreRedemptionRow,\s*\n\s*\} from "@\/lib\/supabase\/storeRedemptions";/,
  );
  assert.match(SOURCE, /let redemptionsEnabled = false;/);
  assert.match(SOURCE, /redemptionsEnabled = await isStoreRedemptionAvailable\(\);/);
  assert.match(
    SOURCE,
    /catch \(error\) \{\s*\n\s*logSupabaseError\("Unable to determine Store availability -- failing closed:", error\);\s*\n\s*\}/,
  );
});

test("Stage B1 audit correction: the availability section's heading/copy actually branches on the real flag, rather than always showing hardcoded closed text", () => {
  assert.match(SOURCE, /\{redemptionsEnabled \? \(/);
  assert.match(SOURCE, /The Store Is Open -- Requests Are Coming Soon/);
});

test("Stage B1 audit correction: no working Redeem action, button, form, or fetch call exists on this page even in the 'enabled' branch", () => {
  assert.doesNotMatch(SOURCE, /onClick=/);
  assert.doesNotMatch(SOURCE, /<form\b/i);
  assert.doesNotMatch(SOURCE, /fetch\(.*\/api\/store\/redeem/);
  assert.doesNotMatch(SOURCE, /requestStoreRedemption/);
});

test("Stage B: this page only ever READS redemption history -- no write, RPC call, or direct ledger table reference exists anywhere on it", () => {
  assert.doesNotMatch(SOURCE, /\.insert\(/);
  assert.doesNotMatch(SOURCE, /\.update\(/);
  assert.doesNotMatch(SOURCE, /\.delete\(/);
  assert.doesNotMatch(SOURCE, /\.from\("coin_transactions"\)/);
  assert.doesNotMatch(SOURCE, /\.from\("store_redemptions"\)/);
  assert.doesNotMatch(SOURCE, /\.rpc\(/);
});

test("Stage B: redemption history is read via the one canonical getLearnerStoreRedemptions() reader, scoped to this exact learner, never hand-queried", () => {
  assert.match(
    SOURCE,
    /import \{\s*\n\s*getLearnerStoreRedemptions,\s*\n\s*isStoreRedemptionAvailable,\s*\n\s*type StoreRedemptionRow,\s*\n\s*\} from "@\/lib\/supabase\/storeRedemptions";/,
  );
  assert.match(SOURCE, /await getLearnerStoreRedemptions\(context\.identity\.learnerId\);/);
});

test("Stage B runtime fix: a redemption-history load failure is tracked SEPARATELY from an empty list (redemptionHistoryUnavailable), so it is never displayed as a false 'you haven't requested anything' empty state", () => {
  assert.match(SOURCE, /let redemptions: StoreRedemptionRow\[\] = \[\];/);
  assert.match(SOURCE, /let redemptionHistoryUnavailable = false;/);
  assert.match(SOURCE, /redemptionHistoryUnavailable = true;/);
  assert.match(
    SOURCE,
    /\{redemptionHistoryUnavailable \? \(\s*\n\s*<p className="rounded-2xl bg-\[#F8FBFF\] p-4 text-sm text-slate-500">\s*\n\s*Unable to load your redemption history right now\.\s*\n\s*<\/p>\s*\n\s*\) : \(\s*\n\s*<RedemptionHistoryList redemptions=\{redemptions\} \/>\s*\n\s*\)\}/,
  );
});

test("Stage B runtime fix: the EXPECTED pre-migration missing-table condition is recognised and logged distinctly from an unrelated/unexpected database error, which must stay observable via logSupabaseError", () => {
  assert.match(
    SOURCE,
    /import \{ isMissingStoreRedemptionsTableError \} from "@\/lib\/supabase\/storeRedemptionErrors";/,
  );
  assert.match(SOURCE, /if \(isMissingStoreRedemptionsTableError\(error\)\) \{/);
  assert.match(SOURCE, /console\.warn\(/);
  assert.match(
    SOURCE,
    /\} else \{\s*\n(?:\s*\/\/.*\n)*\s*logSupabaseError\("Unable to load learner Store redemption history:", error\);/,
  );
});

test("Stage B: the guardian-consent requirement is flagged as a mandatory future gate, not collected as data here", () => {
  assert.match(SOURCE, /guardian consent/i);
  assert.doesNotMatch(SOURCE, /guardianPhone|guardianEmail|guardian_contact/);
});

test("back navigation is a deterministic Link to the existing XP & Coins page, never router.back()", () => {
  assert.match(SOURCE, /href="\/xp-coins"\s*\n\s*prefetch=\{false\}/);
  assert.doesNotMatch(SOURCE, /router\.back\(\)/);
  assert.doesNotMatch(SOURCE, /useRouter/);
});

test("redemptions are explicitly presented as not yet available, with no active Redeem action on this page itself", () => {
  assert.match(SOURCE, /Redemptions Are Not Yet Available/);
  assert.doesNotMatch(SOURCE, /onClick=\{.*[Rr]edeem/);
});

test("no bottom navigation was added -- Stage A does not introduce a new global nav item", () => {
  assert.doesNotMatch(SOURCE, /fixed bottom-0/);
  assert.doesNotMatch(SOURCE, /grid-cols-5/);
});

test("the hero heading is exactly 'Ad Astra Store', with no leftover eyebrow text", () => {
  assert.match(SOURCE, /<h1 className="text-3xl font-extrabold lg:text-4xl">Ad Astra Store<\/h1>/);
  assert.doesNotMatch(SOURCE, /AD ASTRA REWARDS/);
});

test("the hero banner uses next/image at the exact supplied path as a filled background, and the whole hero renders before the Coin wallet section in source order", () => {
  assert.match(SOURCE, /import Image from "next\/image";/);
  assert.match(SOURCE, /src="\/images\/store\/store-hero\.png"/);
  assert.match(SOURCE, /\bfill\b/);

  const heroImageIndex = SOURCE.indexOf("store-hero.png");
  const walletSectionIndex = SOURCE.indexOf("Your Ad Astra Coins");
  assert.ok(heroImageIndex < walletSectionIndex, "the Coin wallet section must stay directly below the hero");
});

test("there is exactly ONE hero card -- the heading/tagline are overlaid on the same section as the background image, never a second separate image card", () => {
  const heroSectionMatch = SOURCE.match(
    /<section className="relative[^"]*">[\s\S]*?<\/section>/,
  );
  assert.ok(heroSectionMatch, "expected a single relative-positioned hero <section>");
  const heroSection = heroSectionMatch![0];

  assert.match(heroSection, /store-hero\.png/);
  assert.match(heroSection, /Ad Astra Store/);
  assert.match(heroSection, /Your effort\. Your rewards\./);

  // Exactly one <Image> element and one src reference to the hero file --
  // confirms the image was not left duplicated in its own card below.
  assert.equal((SOURCE.match(/<Image\b/g) ?? []).length, 1);
  assert.equal((SOURCE.match(/src="\/images\/store\/store-hero\.png"/g) ?? []).length, 1);
});

test("the heading/tagline sit on a dark gradient overlay for readability, positioned toward the upper-left of the hero", () => {
  assert.match(SOURCE, /bg-gradient-to-br from-\[#102A43\]\/90/);
  assert.match(SOURCE, /items-start justify-start/);
});

test("the hero image has descriptive alt text, not an empty/generic string", () => {
  assert.match(SOURCE, /alt="[^"]{15,}"/);
});

test("a discreet non-affiliation disclaimer is shown, never a claim of partnership or endorsement", () => {
  assert.match(
    SOURCE,
    /KFC and Mr D are independent third-party reward providers\. AD Astra is not\s*\n\s*affiliated with or endorsed by either brand\./,
  );
});

test("type safety: no any, @ts-ignore or @ts-expect-error is used anywhere in this file", () => {
  assert.doesNotMatch(SOURCE, /:\s*any\b/);
  assert.doesNotMatch(SOURCE, /@ts-ignore/);
  assert.doesNotMatch(SOURCE, /@ts-expect-error/);
});
