import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SOURCE = readFileSync("components/teachers/MonthlyReportDelivery.tsx", "utf8");

test("loading the section never creates a public link by itself -- only GET is called on mount, never POST", () => {
  const effectFn = SOURCE.match(/useEffect\(\(\) => \{[\s\S]*?\n  \}, \[reportId\]\);/)?.[0];
  assert.ok(effectFn, "mount effect not found");
  assert.match(effectFn!, /fetch\(`\/api\/teacher\/reports\/\$\{reportId\}\/share`\)/);
  assert.doesNotMatch(effectFn!, /method: "POST"/);
});

test("the Send Report button is never removed after a successful send -- resending stays available", () => {
  const buttonMatch = SOURCE.match(
    /<button\s+type="button"\s+onClick=\{\(\) => void sendReport\(\)\}[\s\S]*?<\/button>/,
  );
  assert.ok(buttonMatch, "Send Report button not found");
  // Only "sending" (the in-flight state) may gate this button -- never
  // sendResult, which would hide/replace it once a send has succeeded.
  assert.doesNotMatch(buttonMatch![0], /sendResult/);
  assert.match(buttonMatch![0], /disabled=\{sending/);
});

test("shows an explicit success message after a successful send", () => {
  assert.match(SOURCE, /Report sent successfully\./);
});

test("shows an explicit, non-swallowed error message on send failure", () => {
  assert.match(SOURCE, /setSendResult\("error"\)/);
  assert.match(SOURCE, /\{sendError \? <p className="text-xs font-semibold text-red-600">\{sendError\}<\/p> : null\}/);
});

test("disabling the link requires explicit confirmation before calling the server -- a restrained action, never a single accidental click", () => {
  const disableFn = SOURCE.match(/async function disableLink\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(disableFn, "disableLink not found");
  assert.match(disableFn!, /window\.confirm\(/);
});

test("sends recipients to the send endpoint, never the raw share token or any database id", () => {
  const sendFn = SOURCE.match(/async function sendReport\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(sendFn, "sendReport not found");
  assert.match(sendFn!, /body: JSON\.stringify\(\{ mainRecipient, ccRecipients \}\)/);
});
