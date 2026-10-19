import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// StoreItemCard.tsx is a presentational component with no "server-only"
// import, but this repo has no React Testing Library/JSX test runtime
// configured (every existing components/*.test.ts verifies real source
// text directly -- see components/admin/AdjustCoinsForm.test.ts for the
// identical established convention), so this file does the same.

const SOURCE = readFileSync("components/store/StoreItemCard.tsx", "utf8");

test("renders the provider, Rand value, and Coin price for every item", () => {
  assert.match(SOURCE, /\{item\.provider\}/);
  assert.match(SOURCE, /R\{item\.randValue\}/);
  assert.match(SOURCE, /\{item\.coinCost\.toLocaleString\("en-US"\)\} AC/);
});

test("the redemption state is always disabled -- no onClick, href, or action prop exists on this component", () => {
  assert.doesNotMatch(SOURCE, /onClick=/);
  assert.doesNotMatch(SOURCE, /<Link\b/);
  assert.doesNotMatch(SOURCE, /<a\s/);
  assert.match(SOURCE, /Redemptions Coming Soon/);
});

test("no fabricated external brand image is used -- the visual is built from CSS and icons only", () => {
  assert.doesNotMatch(SOURCE, /<img\b/i);
  assert.doesNotMatch(SOURCE, /next\/image/);
  assert.doesNotMatch(SOURCE, /https?:\/\//);
});

test("the fulfilment note is rendered from the item's own data, never a hardcoded promise", () => {
  assert.match(SOURCE, /\{item\.fulfilmentNote\}/);
});

test("type safety: no any, @ts-ignore or @ts-expect-error is used anywhere in this file", () => {
  assert.doesNotMatch(SOURCE, /:\s*any\b/);
  assert.doesNotMatch(SOURCE, /@ts-ignore/);
  assert.doesNotMatch(SOURCE, /@ts-expect-error/);
});

test("Stage B: the Coin balance comes from a prop, never a second balance calculation inside this component", () => {
  assert.match(SOURCE, /acBalance: number \| null;/);
  assert.doesNotMatch(SOURCE, /getLearnerRewardsSummary|getLearnerCoinBalance/);
  assert.doesNotMatch(SOURCE, /\.from\("coin_transactions"\)/);
});

test("Stage B runtime fix: balance formatting and the affordability comparison are delegated to the shared, independently-tested storeBalanceDisplay helpers, never a bare '!== null' check in this component", () => {
  assert.match(
    SOURCE,
    /import \{ canAffordItem, formatAcBalanceDisplay, hasValidAcBalance \} from "@\/lib\/store\/storeBalanceDisplay";/,
  );
  assert.match(SOURCE, /const hasValidBalance = hasValidAcBalance\(acBalance\);/);
  assert.match(SOURCE, /const hasEnoughCoins = canAffordItem\(acBalance, item\.coinCost\);/);
  assert.match(SOURCE, /\{formatAcBalanceDisplay\(acBalance\)\}/);
  assert.doesNotMatch(SOURCE, /acBalance !== null/);
  assert.doesNotMatch(SOURCE, /acBalance\.toLocaleString/);
});

test("Stage B: the redemption-details disclosure is plain, JS-free HTML (<details>), never a client component or fetch call", () => {
  assert.match(SOURCE, /<details\b/);
  assert.doesNotMatch(SOURCE, /"use client"/);
  assert.doesNotMatch(SOURCE, /fetch\(/);
  assert.doesNotMatch(SOURCE, /useState|useEffect/);
});

test("Stage B: the disclosure never implies a fake confirmation, regardless of availability", () => {
  assert.doesNotMatch(SOURCE, /request (submitted|confirmed|placed)/i);
  assert.doesNotMatch(SOURCE, /\border(ed)?\b/i);
});

test("Stage B1 audit correction: the Store availability line reflects the real redemptionsEnabled prop, never hardcoded 'Closed' text alone", () => {
  assert.match(SOURCE, /redemptionsEnabled: boolean;/);
  assert.match(
    SOURCE,
    /\{redemptionsEnabled\s*\n\s*\? "Open -- but submitting a request isn't available in this app yet\."\s*\n\s*: "Closed -- redemption requests are not yet accepted\."\}/,
  );
});

test("Stage B1 audit correction: even when redemptionsEnabled is true, no working action is added -- the disabled lock button is static, never conditioned on this prop", () => {
  assert.match(SOURCE, /Redemptions Coming Soon/);
  const lockButtonBlock = SOURCE.slice(SOURCE.indexOf("mt-auto flex cursor-not-allowed"));
  assert.doesNotMatch(lockButtonBlock, /redemptionsEnabled/);
  assert.doesNotMatch(SOURCE, /onClick=/);
  assert.doesNotMatch(SOURCE, /<form\b/i);
});
