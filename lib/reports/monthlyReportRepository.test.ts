import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// monthlyReportRepository.ts begins with `import "server-only"` and calls
// createSupabaseAdminClient(), so per this codebase's established
// precedent it cannot be invoked directly in a plain node:test run (no
// live Supabase project or seeded monthly_reports rows are available
// here). These assertions verify the real source's finalisation/
// immutability guarantees directly.

const SOURCE = readFileSync("lib/reports/monthlyReportRepository.ts", "utf8");

test("the repository is server-only", () => {
  assert.match(SOURCE, /^import "server-only";/);
});

test("saveMonthlyReportDraft looks for an existing draft by learner+subject+reportMonth before deciding to insert or update -- avoids confusing duplicates", () => {
  const fn = SOURCE.match(/export async function saveMonthlyReportDraft\([\s\S]*?\n\}\n/)?.[0];
  assert.ok(fn, "saveMonthlyReportDraft not found");
  assert.match(fn!, /findMonthlyReportDraft\(\{/);
  assert.match(fn!, /if \(existingDraft\) \{/);
  assert.match(fn!, /\.insert\(\{/);
});

test("saveMonthlyReportDraft's update path is also gated on .eq(\"status\", \"draft\") -- it can never silently overwrite a finalised report even if reused concurrently", () => {
  const fn = SOURCE.match(/export async function saveMonthlyReportDraft\([\s\S]*?\n\}\n/)?.[0];
  assert.ok(fn);
  const updateBlock = fn!.match(/\.update\(\{[\s\S]*?\.maybeSingle\(\);/)?.[0];
  assert.ok(updateBlock, "update block not found inside saveMonthlyReportDraft");
  assert.match(updateBlock!, /\.eq\("status", "draft"\)/);
});

test("findMonthlyReportDraft only ever matches rows still in draft status -- a finalised report for the same period is never returned by it", () => {
  const fn = SOURCE.match(/export async function findMonthlyReportDraft\([\s\S]*?\n\}\n/)?.[0];
  assert.ok(fn, "findMonthlyReportDraft not found");
  assert.match(fn!, /\.eq\("status", "draft"\)/);
});

test("recomputing a draft snapshot is gated behind an explicit finalised-status check before ever touching the database", () => {
  const fn = SOURCE.match(/export async function recomputeMonthlyReportDraftSnapshot\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "recomputeMonthlyReportDraftSnapshot not found");
  const statusCheckIndex = fn!.indexOf('existing.status === "finalised"');
  const updateCallIndex = fn!.indexOf(".update(");
  assert.ok(statusCheckIndex > -1 && updateCallIndex > -1);
  assert.ok(statusCheckIndex < updateCallIndex);
});

test("every mutating function's update is conditioned on .eq(\"status\", \"draft\") -- a finalised report can never be silently overwritten even under a race", () => {
  const updateBlocks = SOURCE.match(/\.update\(\{[\s\S]*?\.maybeSingle\(\);/g) ?? [];
  assert.ok(updateBlocks.length >= 3, "expected at least 3 conditional update blocks (selection, recompute, finalise)");
  for (const block of updateBlocks) {
    assert.match(block, /\.eq\("status", "draft"\)/);
  }
});

test("a finalise/recompute/update call that matches zero rows (already finalised) throws, it never silently no-ops", () => {
  assert.match(SOURCE, /if \(!data\) \{\s*throw new Error\(/g);
});

test("finalisation recomputes fresh from live data immediately before freezing, then validates the payload before persisting it", () => {
  const fn = SOURCE.match(/export async function finalizeMonthlyReport\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "finalizeMonthlyReport not found");
  assert.match(fn!, /generateMonthlyReportPreview\(/);
  assert.match(fn!, /isMonthlyReportPayload\(payload\)/);
  assert.match(fn!, /status: "finalised"/);
  assert.match(fn!, /finalised_at: new Date\(\)\.toISOString\(\)/);
});

test("finalising an already-finalised report is rejected before any recomputation is attempted", () => {
  const fn = SOURCE.match(/export async function finalizeMonthlyReport\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  const alreadyFinalisedIndex = fn!.indexOf('existing.status === "finalised"');
  const generateIndex = fn!.indexOf("generateMonthlyReportPreview(");
  assert.ok(alreadyFinalisedIndex > -1 && generateIndex > -1);
  assert.ok(alreadyFinalisedIndex < generateIndex);
});

// AD ASTRA MONTHLY REPORT -- STAGE 4B: FINALISE & FREEZE. finalizeMonthlyReport
// now returns a discriminated FinalizeMonthlyReportResult (never throws for
// an expected precondition failure) so the calling route can map each
// specific reason to a distinct HTTP status/code, and enforces every
// precondition from the locked finalisation spec in a fixed order: report
// exists -> not already finalised -> Kingdom commentary exists -> fresh
// recompute -> recomputed payload is structurally valid -> recomputed
// snapshot's hash matches the CURRENT Kingdom generation's snapshotHash
// (never stale) -> the resolved approved commentary is structurally valid
// -> only then the atomic draft-gated update.
test("finalisation requires Kingdom commentary to exist before ever recomputing the payload", () => {
  const fn = SOURCE.match(/export async function finalizeMonthlyReport\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "finalizeMonthlyReport not found");
  const kingdomCheckIndex = fn!.indexOf("!existing.kingdom_comments");
  const generateIndex = fn!.indexOf("generateMonthlyReportPreview(");
  assert.ok(kingdomCheckIndex > -1 && generateIndex > -1);
  assert.ok(kingdomCheckIndex < generateIndex);
  assert.match(fn!, /code: "NO_KINGDOM_COMMENTS"/);
});

test("finalisation rejects stale commentary by comparing the FRESHLY recomputed snapshot's hash against the current Kingdom generation's own snapshotHash, never the row's last-saved snapshot", () => {
  const fn = SOURCE.match(/export async function finalizeMonthlyReport\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "finalizeMonthlyReport not found");
  assert.match(fn!, /const currentSnapshotHash = hashMonthlyReportSnapshot\(payload\);/);
  assert.match(
    fn!,
    /existing\.kingdom_comments\.snapshotHash !== currentSnapshotHash/,
  );
  assert.match(fn!, /code: "STALE_COMMENTARY"/);
  // The hash comparison must happen AFTER the fresh recompute (using
  // `payload`, the just-recomputed value) and BEFORE the row is ever
  // updated -- never against the stale value already stored on `existing`.
  const generateIndex = fn!.indexOf("generateMonthlyReportPreview(");
  const hashIndex = fn!.indexOf("hashMonthlyReportSnapshot(payload)");
  const updateIndex = fn!.indexOf(".update({");
  assert.ok(generateIndex > -1 && hashIndex > -1 && updateIndex > -1);
  assert.ok(generateIndex < hashIndex && hashIndex < updateIndex);
});

test("the approved commentary (teacher-edited if present, otherwise Kingdom's) is resolved via the same centralised precedence helper the preview UI uses, and structurally re-validated before finalising", () => {
  const fn = SOURCE.match(/export async function finalizeMonthlyReport\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "finalizeMonthlyReport not found");
  assert.match(fn!, /resolveDisplayedMonthlyReportComments\(\{/);
  assert.match(fn!, /validateMonthlyReportCommentsStructure\(approvedComments\)/);
  assert.match(fn!, /code: "INVALID_COMMENTS"/);
});

test("finalizeMonthlyReport returns a discriminated result -- success carries the finalised row, failure carries a specific code and message -- rather than throwing for any expected precondition failure", () => {
  assert.match(
    SOURCE,
    /export type FinalizeMonthlyReportResult =\s*\n\s*\| \{ success: true; report: MonthlyReportRow \}\s*\n\s*\| \{ success: false; code: FinalizeMonthlyReportFailureCode; error: string \};/,
  );
  const fn = SOURCE.match(/export async function finalizeMonthlyReport\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  assert.match(fn!, /Promise<FinalizeMonthlyReportResult>/);
  assert.match(fn!, /return \{ success: true, report: data as MonthlyReportRow \};/);
});

test("a concurrent finalisation (the row is no longer a draft by the time the update runs) is reported as a specific failure code, not a thrown error", () => {
  const fn = SOURCE.match(/export async function finalizeMonthlyReport\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  const updateBlock = fn!.match(/\.update\(\{[\s\S]*$/)?.[0];
  assert.ok(updateBlock, "final update block not found");
  assert.match(updateBlock!, /\.eq\("status", "draft"\)/);
  assert.match(updateBlock!, /code: "CONCURRENT_FINALISATION"/);
});

// AD ASTRA MONTHLY REPORT -- STAGE 3/4A: saveMonthlyReportKingdomComments
// is the ONE function permitted to write kingdom_comments, and
// saveMonthlyReportTeacherEditedComments is the ONE function permitted to
// write teacher_edited_comments -- neither ever touches the other's
// field, and every other mutating function leaves both completely
// untouched. This is the data-layer guarantee behind "regenerating
// Kingdom's commentary never destroys a teacher's edits" and "editing
// never mutates Kingdom's original generation."
test("kingdom_comments and teacher_edited_comments are each written by exactly one dedicated function, and neither function touches the other's field", () => {
  const updateBlocks = SOURCE.match(/\.update\(\{[\s\S]*?\}\)/g) ?? [];
  assert.ok(updateBlocks.length > 0);

  const blocksWritingKingdomComments = updateBlocks.filter((block) =>
    /kingdom_comments: storedComments/.test(block),
  );
  assert.equal(blocksWritingKingdomComments.length, 1, "expected exactly one update block writing kingdom_comments");
  assert.doesNotMatch(blocksWritingKingdomComments[0]!, /teacher_edited_comments/);

  const blocksWritingTeacherEditedComments = updateBlocks.filter((block) =>
    /teacher_edited_comments: storedComments/.test(block),
  );
  assert.equal(
    blocksWritingTeacherEditedComments.length,
    1,
    "expected exactly one update block writing teacher_edited_comments",
  );
  assert.doesNotMatch(blocksWritingTeacherEditedComments[0]!, /kingdom_comments/);

  const otherBlocks = updateBlocks.filter(
    (block) => !blocksWritingKingdomComments.includes(block) && !blocksWritingTeacherEditedComments.includes(block),
  );
  for (const block of otherBlocks) {
    assert.doesNotMatch(block, /kingdom_comments|teacher_edited_comments/);
  }
});

test("saveMonthlyReportTeacherEditedComments is draft-only, exactly like every other mutation here", () => {
  const fn = SOURCE.match(/export async function saveMonthlyReportTeacherEditedComments\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "saveMonthlyReportTeacherEditedComments not found");
  assert.match(fn!, /\.eq\("status", "draft"\)/);
  assert.match(fn!, /if \(!data\) \{\s*throw new Error\(/);
});

test("saveMonthlyReportKingdomComments is draft-only, exactly like every other mutation here, and never calls OpenAI itself -- the network call lives in the separate kingdomMonthlyReportGeneration.ts", () => {
  const fn = SOURCE.match(/export async function saveMonthlyReportKingdomComments\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "saveMonthlyReportKingdomComments not found");
  assert.match(fn!, /\.eq\("status", "draft"\)/);
  assert.match(fn!, /if \(!data\) \{\s*throw new Error\(/);
  assert.doesNotMatch(SOURCE, /openai|OpenAI/i);
});

test("the repository is the only place that writes to monthly_reports -- it uses the admin client, never a client-facing Supabase import", () => {
  assert.match(SOURCE, /import \{ createSupabaseAdminClient \} from "@\/lib\/supabase\/server";/);
  assert.doesNotMatch(SOURCE, /createSupabaseRequestClient|createSupabaseBrowserClient/);
});

// AD ASTRA MONTHLY REPORT -- STAGE 4D: TEACHER FINALISED REPORT ARCHIVE.
test("findFinalisedMonthlyReportById enforces status='finalised' in the QUERY itself -- a draft can never be returned even if a caller forgets to check .status afterwards", () => {
  const fn = SOURCE.match(/export async function findFinalisedMonthlyReportById\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "findFinalisedMonthlyReportById not found");
  assert.match(fn!, /\.eq\("id", reportId\)/);
  assert.match(fn!, /\.eq\("status", "finalised"\)/);
});

test("findFinalisedMonthlyReportById never calls the live report engine -- it only ever reads the stored row", () => {
  const fn = SOURCE.match(/export async function findFinalisedMonthlyReportById\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  assert.doesNotMatch(fn!, /generateMonthlyReportPreview/);
});

// AD ASTRA MONTHLY REPORT -- STAGE 4D: ONE-REPORT-PER-PERIOD GUARD. A real
// database investigation found 3 existing finalised rows for one learner/
// subject/month (from repeated Stage 4C manual testing), which blocks a
// database-level unique index from being added right now -- see this
// stage's own report for the exact row IDs. This is the forward-looking
// application-level guard in the meantime: it must stop any NEW draft
// insert for a period that already has an official finalised report,
// without ever touching existing rows.
test("saveMonthlyReportDraft checks for an existing finalised report BEFORE inserting a new draft -- but only on the insert path, never the update path (updating an existing draft is always legitimate)", () => {
  const fn = SOURCE.match(/export async function saveMonthlyReportDraft\([\s\S]*?\n\}\n/)?.[0];
  assert.ok(fn, "saveMonthlyReportDraft not found");
  const insertPath = fn!.slice(fn!.indexOf("if (existingDraft) {"));
  const guardIndex = insertPath.indexOf("hasFinalisedMonthlyReport(");
  const insertIndex = insertPath.indexOf(".insert({");
  assert.ok(guardIndex > -1 && insertIndex > -1, "expected the guard before the fresh insert");
  assert.ok(guardIndex < insertIndex);
  assert.match(insertPath, /throw new MonthlyReportPeriodAlreadyFinalisedError\(\);/);
});

test("createMonthlyReportDraft applies the exact same one-report-per-period guard before its own unconditional insert", () => {
  const start = SOURCE.indexOf("export async function createMonthlyReportDraft(");
  const end = SOURCE.indexOf("export async function updateMonthlyReportSelection(", start);
  assert.ok(start > -1 && end > start, "createMonthlyReportDraft not found");
  const fn = SOURCE.slice(start, end);
  const guardIndex = fn.indexOf("hasFinalisedMonthlyReport(");
  const insertIndex = fn.indexOf(".insert({");
  assert.ok(guardIndex > -1 && insertIndex > -1 && guardIndex < insertIndex);
  assert.match(fn, /throw new MonthlyReportPeriodAlreadyFinalisedError\(\);/);
});

test("the finalised-period guard checks status='finalised' specifically, scoped to the exact learner+subject+reportMonth key -- never a broader or narrower match", () => {
  const start = SOURCE.indexOf("async function hasFinalisedMonthlyReport(");
  const end = SOURCE.indexOf("export async function listMonthlyReportsForLearnerSubject(", start);
  assert.ok(start > -1 && end > start, "hasFinalisedMonthlyReport not found");
  const fn = SOURCE.slice(start, end);
  assert.match(fn, /\.eq\("learner_id", learnerId\)/);
  assert.match(fn, /\.eq\("subject_id", subjectId\)/);
  assert.match(fn, /\.eq\("report_month", reportMonth\)/);
  assert.match(fn, /\.eq\("status", "finalised"\)/);
});

test("MonthlyReportPeriodAlreadyFinalisedError is a real, dedicated Error subclass (matching this codebase's existing precedent, e.g. TeacherApiError/LiveClassApiError) rather than a generic thrown string", () => {
  assert.match(SOURCE, /export class MonthlyReportPeriodAlreadyFinalisedError extends Error \{/);
});

test("findFinalisedMonthlyReportForPeriod is scoped to the exact learner+subject+reportMonth key and status='finalised', returning only the id -- never the full row", () => {
  const start = SOURCE.indexOf("export async function findFinalisedMonthlyReportForPeriod(");
  assert.ok(start > -1, "findFinalisedMonthlyReportForPeriod not found");
  const fn = SOURCE.slice(start, start + 900);
  assert.match(fn, /\.select\("id"\)/);
  assert.match(fn, /\.eq\("learner_id", learnerId\)/);
  assert.match(fn, /\.eq\("subject_id", subjectId\)/);
  assert.match(fn, /\.eq\("report_month", reportMonth\)/);
  assert.match(fn, /\.eq\("status", "finalised"\)/);
  assert.match(fn, /Promise<\{ id: string \} \| null>/);
});

// AD ASTRA MONTHLY REPORT -- STAGE 4E: RACE-CONDITION PROTECTION. The
// Stage 4D application-level guard (hasFinalisedMonthlyReport, checked
// well before this point in finalizeMonthlyReport) is only a friendly
// first layer -- it reads state, then this function still performs its
// own separate write later. Two finalisation attempts for the SAME period
// can race between that read and this write. The database's own partial
// unique index (Stage 4E migration) is what actually stops the second one
// -- surfaced here as a specific 23505 check, converted into a controlled
// discriminated-result failure rather than left to propagate as a raw,
// unhandled Postgres error.
test("finalizeMonthlyReport converts a 23505 unique-violation on its own finalising update into the specific ALREADY_FINALISED_PERIOD failure code, never a raw thrown database error", () => {
  const fn = SOURCE.match(/export async function finalizeMonthlyReport\([\s\S]*?\n\}$/m)?.[0];
  assert.ok(fn, "finalizeMonthlyReport not found");
  assert.match(fn!, /if \(error\.code === "23505"\) \{/);
  assert.match(fn!, /code: "ALREADY_FINALISED_PERIOD"/);
  // The 23505 check must happen on the row's OWN finalising update, before
  // the generic `if (error) throw error;` fallback that every other
  // unexpected database error still goes through unchanged.
  const conditionIndex = fn!.indexOf('if (error.code === "23505")');
  const genericThrowIndex = fn!.lastIndexOf("throw error;");
  assert.ok(conditionIndex > -1 && genericThrowIndex > -1 && conditionIndex < genericThrowIndex);
});

test("ALREADY_FINALISED_PERIOD is a real member of FinalizeMonthlyReportFailureCode, not an ad hoc string only used in one place", () => {
  const typeDecl = SOURCE.match(/export type FinalizeMonthlyReportFailureCode =[\s\S]*?;/)?.[0];
  assert.ok(typeDecl, "FinalizeMonthlyReportFailureCode not found");
  assert.match(typeDecl!, /"ALREADY_FINALISED_PERIOD"/);
});

test("finalisation atomicity is unchanged by this race-condition handling -- the update is still gated on .eq(\"status\", \"draft\") exactly as before", () => {
  const fn = SOURCE.match(/export async function finalizeMonthlyReport\([\s\S]*?\n\}$/m)?.[0];
  assert.ok(fn);
  const updateBlock = fn!.match(/\.update\(\{[\s\S]*?\.maybeSingle\(\);/)?.[0];
  assert.ok(updateBlock, "the finalising update block was not found");
  assert.match(updateBlock!, /\.eq\("status", "draft"\)/);
});
