import assert from "node:assert/strict";
import test from "node:test";
import { hashPdfBytes, hashReadingContentText } from "./contentHash";

test("identical content_text always hashes identically (deterministic)", () => {
  const a = hashReadingContentText('{"format":"ad-astra-structured-reading"}');
  const b = hashReadingContentText('{"format":"ad-astra-structured-reading"}');
  assert.equal(a, b);
});

test("any content change produces a different hash", () => {
  const a = hashReadingContentText("original content");
  const b = hashReadingContentText("original content edited");
  assert.notEqual(a, b);
});

test("identical PDF bytes always hash identically", () => {
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);
  assert.equal(hashPdfBytes(bytes), hashPdfBytes(new Uint8Array(bytes)));
});

test("different PDF bytes hash differently", () => {
  const a = hashPdfBytes(new Uint8Array([1, 2, 3]));
  const b = hashPdfBytes(new Uint8Array([1, 2, 4]));
  assert.notEqual(a, b);
});

test("hashes are non-empty hex strings, safe to store as a text column", () => {
  const hash = hashReadingContentText("some reading text");
  assert.match(hash, /^[0-9a-f]{64}$/);
});
