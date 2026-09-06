import assert from "node:assert/strict";
import test from "node:test";
import { generateShareToken } from "./monthlyReportShareToken";

test("generateShareToken produces a URL-safe token with no characters needing escaping", () => {
  const token = generateShareToken();
  assert.match(token, /^[A-Za-z0-9_-]+$/);
});

test("generateShareToken produces at least 256 bits of entropy (32 raw bytes, base64url-encoded)", () => {
  const token = generateShareToken();
  // 32 bytes base64url-encoded (no padding) is 43 characters.
  assert.equal(token.length, 43);
});

test("generateShareToken never repeats across calls", () => {
  const tokens = new Set(Array.from({ length: 1000 }, () => generateShareToken()));
  assert.equal(tokens.size, 1000);
});
