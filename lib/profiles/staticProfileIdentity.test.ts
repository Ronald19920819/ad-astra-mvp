import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const liveProfileFiles = [
  "app/profile/page.tsx",
  "app/home/page.tsx",
  "app/subjects/page.tsx",
  "app/teacher/page.tsx",
  "app/teacher/profile/page.tsx",
  "app/teacher/subjects/page.tsx",
  "app/teacher/messages/page.tsx",
  "app/teacher/messages/danielle-coetzee/page.tsx",
];

test("live learner and teacher profile UI contains no fixture identity", () => {
  const content = liveProfileFiles
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  assert.doesNotMatch(content, /Danielle Coetzee|Ronald Petersen|RE Petersen/);
  assert.doesNotMatch(
    content,
    /learner-profile\.png|teacher-profile\.png|re-petersen\.png/,
  );
});
