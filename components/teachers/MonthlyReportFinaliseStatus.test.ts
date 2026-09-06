import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  MonthlyReportFinaliseStatus,
  deriveCommentaryFreshness,
  type CommentaryFreshness,
} from "./MonthlyReportFinaliseStatus";

// AD ASTRA MONTHLY REPORT -- FINALISATION HASH-MISMATCH INVESTIGATION:
// this component has no next/font/local, next/image, or data-fetching
// dependency, so -- unlike MonthlyReportGenerator.tsx -- it can be
// rendered for REAL via react-dom/server in a plain node:test run. These
// tests assert against ACTUAL RENDERED HTML OUTPUT, not source-text
// regex, proving the "stale warning and Finalise Report can never
// coexist" invariant the hard way.

const STALE_TEXT = "content has changed since Kingdom";
const FINALISE_BUTTON_TEXT = "Finalise Report";
const FINALISED_INDICATOR_TEXT = "Finalised";

function render(props: {
  isFinalised: boolean;
  finalisedAt: string | null;
  commentaryFreshness: CommentaryFreshness;
  finalizing: boolean;
  finalizeError: string;
}) {
  return renderToStaticMarkup(
    React.createElement(MonthlyReportFinaliseStatus, {
      ...props,
      onFinalize: () => {},
    }),
  );
}

test("deriveCommentaryFreshness: no displayed commentary -> no_commentary, regardless of staleness", () => {
  assert.equal(deriveCommentaryFreshness(false, false), "no_commentary");
  assert.equal(deriveCommentaryFreshness(false, true), "no_commentary");
});

test("deriveCommentaryFreshness: commentary exists and is stale -> stale", () => {
  assert.equal(deriveCommentaryFreshness(true, true), "stale");
});

test("deriveCommentaryFreshness: commentary exists and is not stale -> fresh", () => {
  assert.equal(deriveCommentaryFreshness(true, false), "fresh");
});

test("State A -- no commentary: explanatory message rendered, Finalise Report absent, no stale warning", () => {
  const html = render({
    isFinalised: false,
    finalisedAt: null,
    commentaryFreshness: "no_commentary",
    finalizing: false,
    finalizeError: "",
  });
  assert.match(html, /Generate Report Comments above/);
  assert.doesNotMatch(html, new RegExp(FINALISE_BUTTON_TEXT));
  assert.doesNotMatch(html, new RegExp(STALE_TEXT));
});

test("State B -- stale: warning rendered, Finalise Report absent", () => {
  const html = render({
    isFinalised: false,
    finalisedAt: null,
    commentaryFreshness: "stale",
    finalizing: false,
    finalizeError: "",
  });
  assert.match(html, new RegExp(STALE_TEXT));
  assert.doesNotMatch(html, new RegExp(FINALISE_BUTTON_TEXT));
});

test("State C -- fresh: Finalise Report rendered, no stale warning", () => {
  const html = render({
    isFinalised: false,
    finalisedAt: null,
    commentaryFreshness: "fresh",
    finalizing: false,
    finalizeError: "",
  });
  assert.match(html, new RegExp(FINALISE_BUTTON_TEXT));
  assert.doesNotMatch(html, new RegExp(STALE_TEXT));
});

test("State D -- finalised: read-only Finalised indicator only, no stale warning, no Finalise Report button, regardless of commentaryFreshness", () => {
  for (const commentaryFreshness of ["no_commentary", "stale", "fresh"] as const) {
    const html = render({
      isFinalised: true,
      finalisedAt: "2026-09-01T00:00:00.000Z",
      commentaryFreshness,
      finalizing: false,
      finalizeError: "",
    });
    assert.match(html, new RegExp(FINALISED_INDICATOR_TEXT));
    assert.doesNotMatch(html, new RegExp(STALE_TEXT));
    assert.doesNotMatch(html, /<button/);
  }
});

// ---------------------------------------------------------------------
// THE core invariant this whole investigation exists to prove, tested
// against REAL rendered output across every reachable state combination.
// ---------------------------------------------------------------------
test("INVARIANT: the literal stale-warning text and the literal Finalise Report button can never both appear in the same rendered output, for any state combination", () => {
  const freshnessStates: CommentaryFreshness[] = ["no_commentary", "stale", "fresh"];
  const finalizeErrors = ["", "Some error from a previous attempt."];

  for (const isFinalised of [true, false]) {
    for (const commentaryFreshness of freshnessStates) {
      for (const finalizeError of finalizeErrors) {
        const html = render({
          isFinalised,
          finalisedAt: isFinalised ? "2026-09-01T00:00:00.000Z" : null,
          commentaryFreshness,
          finalizing: false,
          finalizeError,
        });
        const hasStaleWarning = new RegExp(STALE_TEXT).test(html);
        const hasFinaliseButton = new RegExp(FINALISE_BUTTON_TEXT).test(html);
        assert.ok(
          !(hasStaleWarning && hasFinaliseButton),
          `impossible state rendered for isFinalised=${isFinalised}, commentaryFreshness=${commentaryFreshness}, finalizeError=${JSON.stringify(finalizeError)}:\n${html}`,
        );
      }
    }
  }
});
