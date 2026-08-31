import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getAbsoluteAppUrl } from "./appUrl";

const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
const ORIGINAL_VERCEL_URL = process.env.VERCEL_URL;

function resetEnv() {
  if (ORIGINAL_SITE_URL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE_URL;

  if (ORIGINAL_VERCEL_URL === undefined) delete process.env.VERCEL_URL;
  else process.env.VERCEL_URL = ORIGINAL_VERCEL_URL;
}

test("NEXT_PUBLIC_SITE_URL takes priority when set", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://app.ad-astra.example";
  process.env.VERCEL_URL = "some-preview-deployment.vercel.app";
  try {
    assert.equal(
      getAbsoluteAppUrl("/your-work/abc-123"),
      "https://app.ad-astra.example/your-work/abc-123",
    );
  } finally {
    resetEnv();
  }
});

test("a trailing slash on NEXT_PUBLIC_SITE_URL is normalised away, never producing a double slash", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://app.ad-astra.example/";
  try {
    assert.equal(
      getAbsoluteAppUrl("/your-work/abc-123"),
      "https://app.ad-astra.example/your-work/abc-123",
    );
  } finally {
    resetEnv();
  }
});

test("falls back to the Vercel-provided host when NEXT_PUBLIC_SITE_URL is unset", () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  process.env.VERCEL_URL = "ad-astra-git-main.vercel.app";
  try {
    assert.equal(
      getAbsoluteAppUrl("/your-work/abc-123"),
      "https://ad-astra-git-main.vercel.app/your-work/abc-123",
    );
  } finally {
    resetEnv();
  }
});

test("falls back to localhost when neither NEXT_PUBLIC_SITE_URL nor VERCEL_URL is set", () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_URL;
  try {
    assert.equal(
      getAbsoluteAppUrl("/your-work/abc-123"),
      "http://localhost:3000/your-work/abc-123",
    );
  } finally {
    resetEnv();
  }
});

test("a path given without a leading slash is still joined correctly", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://app.ad-astra.example";
  try {
    assert.equal(
      getAbsoluteAppUrl("your-work/abc-123"),
      "https://app.ad-astra.example/your-work/abc-123",
    );
  } finally {
    resetEnv();
  }
});

test("never couples URL construction to a live Request object -- no new URL(..., request) pattern exists in this module", () => {
  const source = readFileSync("lib/email/appUrl.ts", "utf8");
  assert.doesNotMatch(source, /new URL\(/);
  assert.doesNotMatch(source, /\brequest\.url\b(?!-based)/);
});
