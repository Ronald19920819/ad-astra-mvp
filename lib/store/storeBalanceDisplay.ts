// Pure helpers for displaying a learner's AD Astra Coin balance on the
// Store -- extracted from components/store/StoreItemCard.tsx and
// app/store/page.tsx so this exact logic can be genuinely unit-tested
// (no "server-only" import, no React, no database call), rather than
// only verified by reading the surrounding JSX source.
//
// The declared type is `number | null` everywhere this is used (null
// means "failed to load", never a fabricated 0) -- but every function
// here is deliberately typed to accept `number | null | undefined` and
// guards with `typeof value === "number"`, not `value !== null`. A
// runtime crash (TypeError: Cannot read properties of undefined) was
// observed in production despite the stricter declared type, because
// TypeScript's type annotations are not enforced at runtime -- a value
// that is actually `undefined` still satisfies `!== null`. The typeof
// guard is the one check that is safe regardless of how a caller
// mistake, a future refactor, or a serialization boundary might hand
// this an undefined value the type system didn't catch.

export function hasValidAcBalance(
  acBalance: number | null | undefined,
): acBalance is number {
  return typeof acBalance === "number" && Number.isFinite(acBalance);
}

// Never returns a fabricated "0 AC" for a missing/invalid balance --
// only ever formats a genuine number.
export function formatAcBalanceDisplay(
  acBalance: number | null | undefined,
): string {
  if (!hasValidAcBalance(acBalance)) return "unavailable";
  return `${acBalance.toLocaleString("en-US")} AC`;
}

// null/undefined -> false (never treated as "affordable" or "not
// affordable" with any confidence -- callers must render this
// separately from a genuine true/false when the balance is unavailable,
// e.g. not showing "not yet enough for this reward" when the real
// answer is simply unknown).
export function canAffordItem(
  acBalance: number | null | undefined,
  coinCost: number,
): boolean {
  return hasValidAcBalance(acBalance) && acBalance >= coinCost;
}
