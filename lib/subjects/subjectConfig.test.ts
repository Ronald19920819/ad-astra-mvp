import assert from "node:assert/strict";
import test from "node:test";
import { buildSubjectRoute, subjectConfigurations } from "./subjectConfig";

const businessStudiesIG2 = subjectConfigurations["business-studies"];
const businessStudiesIG1 = subjectConfigurations["business-studies-igcse-1"];
const historyIG2 = subjectConfigurations["history"];
const historyIG1 = subjectConfigurations["history-igcse-1"];
const englishStage9 = subjectConfigurations["english"];
const englishStage8 = subjectConfigurations["english-stage-8"];
const afrikaansStage9 = subjectConfigurations["afrikaans"];
const afrikaansStage8 = subjectConfigurations["afrikaans-stage-8"];

// K. subject back button -> returns to correct subject dashboard, via the
// same buildSubjectRoute helper Your Work's subject page uses for its
// back link.
test("K: buildSubjectRoute resolves each subject's own dashboard, disambiguated by subject UUID", () => {
  const ig2Route = buildSubjectRoute(businessStudiesIG2, "learnerDashboard");
  const ig1Route = buildSubjectRoute(businessStudiesIG1, "learnerDashboard");

  assert.ok(ig2Route.includes(businessStudiesIG2.databaseId));
  assert.ok(ig1Route.includes(businessStudiesIG1.databaseId));
  // Both variants share the same family route PATH (routes are keyed per
  // family, not per exact subject) -- disambiguation is entirely via the
  // ?subject= query param, so the two routes must differ despite sharing
  // a path prefix.
  assert.equal(
    ig2Route.split("?")[0],
    ig1Route.split("?")[0],
  );
  assert.notEqual(ig2Route, ig1Route);
});

test("K: History IG1/IG2 back routes resolve to their own exact subject UUID", () => {
  const ig2Route = buildSubjectRoute(historyIG2, "learnerDashboard");
  const ig1Route = buildSubjectRoute(historyIG1, "learnerDashboard");

  assert.ok(ig2Route.includes(historyIG2.databaseId));
  assert.ok(ig1Route.includes(historyIG1.databaseId));
  assert.notEqual(ig2Route, ig1Route);
});

// M. IGCSE 1/2 isolation preserved
test("M: Business Studies and History IGCSE 1/2 variants have distinct database UUIDs", () => {
  assert.notEqual(businessStudiesIG1.databaseId, businessStudiesIG2.databaseId);
  assert.notEqual(historyIG1.databaseId, historyIG2.databaseId);
});

// L. Stage 8/9 isolation preserved
test("L: English and Afrikaans Stage 8/9 variants have distinct database UUIDs", () => {
  assert.notEqual(englishStage8.databaseId, englishStage9.databaseId);
  assert.notEqual(afrikaansStage8.databaseId, afrikaansStage9.databaseId);
});

test("L: Stage 8/9 back routes are disambiguated by UUID on a shared path", () => {
  const stage9Route = buildSubjectRoute(englishStage9, "learnerDashboard");
  const stage8Route = buildSubjectRoute(englishStage8, "learnerDashboard");

  assert.equal(stage9Route.split("?")[0], stage8Route.split("?")[0]);
  assert.notEqual(stage9Route, stage8Route);
});
