import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// "use client" component -- verified via source inspection, matching
// this codebase's established convention.

const SOURCE = readFileSync("components/admin/AdjustCoinsForm.tsx", "utf8");

test("the administrator only ever types a positive amount -- Add/Subtract is a separate toggle, never a signed number input", () => {
  assert.match(SOURCE, /type="number"/);
  assert.match(SOURCE, /min=\{1\}/);
  assert.doesNotMatch(SOURCE, /min=\{-|type="number"[\s\S]{0,40}min={-1/);
  assert.match(SOURCE, /setAdjustmentType\("add"\)/);
  assert.match(SOURCE, /setAdjustmentType\("subtract"\)/);
});

test("the sign is derived entirely from adjustmentType, never typed -- 'Add' produces a positive signedAmount, 'Subtract' produces a negative one", () => {
  assert.match(
    SOURCE,
    /const signedAmount = isAmountValid \? \(adjustmentType === "add" \? parsedAmount : -parsedAmount\) : 0;/,
  );
});

test("only the five administrator-adjustable categories are offered -- never lesson_activity_reward, store_redemption, or ad_astra_contribution", () => {
  const optionsBlock = SOURCE.match(/const CATEGORY_OPTIONS:[\s\S]*?\];/)?.[0];
  assert.ok(optionsBlock, "CATEGORY_OPTIONS not found");
  assert.match(optionsBlock!, /"admin_adjustment"/);
  assert.match(optionsBlock!, /"correction"/);
  assert.match(optionsBlock!, /"competition_award"/);
  assert.match(optionsBlock!, /"promotional_award"/);
  assert.match(optionsBlock!, /"special_achievement"/);
  assert.doesNotMatch(optionsBlock!, /lesson_activity_reward|store_redemption|ad_astra_contribution/);
});

test("category labels are resolved via the canonical mapping, never a second hand-written label list", () => {
  assert.match(
    SOURCE,
    /import \{ resolveCoinTransactionTypeLabel \} from "@\/lib\/coins\/coinTransactionTypeLabels";/,
  );
  assert.match(SOURCE, /resolveCoinTransactionTypeLabel\(option\)/);
});

test("the Related Transaction picker only appears when Correction is selected, and is required before proceeding to confirmation", () => {
  assert.match(SOURCE, /\{category === "correction" \? \(/);
  const goToConfirmFn = SOURCE.match(/function goToConfirm\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(goToConfirmFn, "goToConfirm not found");
  assert.match(
    goToConfirmFn!,
    /if \(category === "correction" && !referenceTransactionId\) \{/,
  );
});

test("reason is mandatory before proceeding to confirmation; admin note is never required", () => {
  const goToConfirmFn = SOURCE.match(/function goToConfirm\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(goToConfirmFn);
  assert.match(goToConfirmFn!, /if \(!reason\.trim\(\)\) \{/);
  assert.doesNotMatch(goToConfirmFn!, /adminNote\.trim\(\)\) \{/);
});

test("the client pre-checks that a deduction would not take the learner below 0 AC before allowing confirmation -- a UX courtesy, not the authoritative check", () => {
  const goToConfirmFn = SOURCE.match(/function goToConfirm\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(goToConfirmFn);
  assert.match(
    goToConfirmFn!,
    /if \(adjustmentType === "subtract" && previewNewBalance < 0\) \{/,
  );
});

test("the confirmation step shows learner, current balance, signed adjustment, new balance, category, and reason -- exactly what Part H requires", () => {
  const confirmBlock = SOURCE.match(/\{step === "edit" \? \([\s\S]*?\) : \(([\s\S]*?)\)\}\s*\n\s*<\/section>/)?.[1];
  assert.ok(confirmBlock, "confirmation step block not found");
  assert.match(confirmBlock!, /Learner:/);
  assert.match(confirmBlock!, /Current Balance:/);
  assert.match(confirmBlock!, /Adjustment:/);
  assert.match(confirmBlock!, /New Balance:/);
  assert.match(confirmBlock!, /Category:/);
  assert.match(confirmBlock!, /Reason:/);
});

test("submission is guarded against double-submit -- the function bails out if already submitting, and the confirm button is disabled while in flight", () => {
  const submitFn = SOURCE.match(/async function submit\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(submitFn, "submit not found");
  assert.match(submitFn!, /if \(isSubmitting\) return;/);
  assert.match(SOURCE, /disabled=\{isSubmitting\}/);
});

test("posts to the dedicated adjustment route for this exact learner, sending adjustmentType + positive amount + category + reason -- never a pre-signed amount", () => {
  const submitFn = SOURCE.match(/async function submit\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(submitFn);
  assert.match(submitFn!, /fetch\(`\/api\/teacher\/admin\/coins\/\$\{learnerId\}\/adjust`/);
  assert.match(submitFn!, /adjustmentType,/);
  assert.match(submitFn!, /amount: parsedAmount,/);
  assert.match(submitFn!, /category,/);
  assert.match(submitFn!, /reason: reason\.trim\(\),/);
});

test("on success, calls onSuccess with the exact required message wording for both add and subtract", () => {
  const submitFn = SOURCE.match(/async function submit\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(submitFn);
  assert.match(submitFn!, /added successfully\./);
  assert.match(submitFn!, /deducted successfully\./);
});

test("never renders a raw transaction UUID as visible text in the Related Transaction picker -- only date/amount/type, the id is used solely as the option value", () => {
  const optionBlock = SOURCE.match(/<option key=\{transaction\.id\} value=\{transaction\.id\}>[\s\S]*?<\/option>/)?.[0];
  assert.ok(optionBlock, "transaction option not found");
  assert.doesNotMatch(optionBlock!, />\s*\{transaction\.id\}/);
});
