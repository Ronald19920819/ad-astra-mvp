import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Presentational component, no "server-only" import -- but this repo has
// no React Testing Library/JSX test runtime configured (see
// components/store/StoreItemCard.test.ts's own header comment for the
// identical established convention), so this verifies real source text.

const SOURCE = readFileSync("components/store/RedemptionHistoryList.tsx", "utf8");

test("the empty state is exactly 'You have not requested any rewards yet.'", () => {
  assert.match(SOURCE, /You have not requested any rewards yet\./);
});

test("the list renders via a map over the redemptions prop, never hand-listed", () => {
  assert.match(SOURCE, /redemptions\.map\(\(redemption\) =>/);
});

test("the list is read-only -- no onClick, href, form, or fetch exists in this component", () => {
  assert.doesNotMatch(SOURCE, /onClick=/);
  assert.doesNotMatch(SOURCE, /<Link\b/);
  assert.doesNotMatch(SOURCE, /<form\b/i);
  assert.doesNotMatch(SOURCE, /fetch\(/);
});

test("each row shows the provider, denomination, Coin amount, request date, and status, all sourced from the row itself", () => {
  assert.match(SOURCE, /\{redemption\.provider\} R\{redemption\.rand_value\}/);
  assert.match(SOURCE, /\{redemption\.coin_cost\.toLocaleString\("en-US"\)\} AC/);
  assert.match(SOURCE, /\{redemption\.status\}/);
  assert.match(SOURCE, /redemption\.requested_at/);
});

test("type safety: no any, @ts-ignore or @ts-expect-error is used anywhere in this file", () => {
  assert.doesNotMatch(SOURCE, /:\s*any\b/);
  assert.doesNotMatch(SOURCE, /@ts-ignore/);
  assert.doesNotMatch(SOURCE, /@ts-expect-error/);
});
