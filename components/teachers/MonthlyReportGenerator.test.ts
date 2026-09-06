import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// MonthlyReportGenerator.tsx transitively imports next/font/local (via
// app/fonts.ts's neueHaas), which -- like "server-only" -- only works
// inside a real Next.js build and throws under a plain node:test/tsx
// run ("(0 , import_local.default) is not a function"). So, matching
// this codebase's established convention for client components that
// can't be safely imported directly, these assertions verify the real
// source text instead.

const SOURCE = readFileSync("components/teachers/MonthlyReportGenerator.tsx", "utf8");

test("lesson status labels are human-readable without changing the underlying deterministic meaning", () => {
  const fn = SOURCE.match(/export function lessonStatusLabel\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "lessonStatusLabel not found");
  assert.match(fn!, /case "Complete":\s*return "Complete";/);
  assert.match(fn!, /case "Late":\s*return "Completed Late";/);
  assert.match(fn!, /case "Overdue":\s*return "Overdue";/);
  assert.match(fn!, /case "Incomplete":\s*return "Not Yet Due";/);
});

test("an outstanding (never-submitted) activity is clearly labelled Outstanding, distinct from Submitted/Awaiting Review/Returned", () => {
  const fn = SOURCE.match(/export function activityStatusLabel\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "activityStatusLabel not found");
  assert.match(fn!, /submissionStatus === "not_submitted"/);
  assert.match(fn!, /"Outstanding \(Overdue\)" : "Outstanding"/);
  assert.match(fn!, /"Awaiting Review"/);
  assert.match(fn!, /"Returned"/);
});

test("Kingdom's preliminary result is never used as an authoritative status/result anywhere in this component", () => {
  assert.doesNotMatch(SOURCE, /preliminary_mark|preliminary_percentage|kingdom_marked_at/);
});

test("formatPercentage renders an em dash (never 0% or NaN%) when no authoritative percentage exists", () => {
  const fn = SOURCE.match(/export function formatPercentage\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "formatPercentage not found");
  assert.match(fn!, /value === null \? "—"/);
});

test("formatRate renders a readable message (never NaN%/0%) when nothing was selected in that dimension", () => {
  const fn = SOURCE.match(/export function formatRate\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "formatRate not found");
  assert.match(fn!, /value === null \? "No selected items"/);
});

test("LOCKED: the content-selection checklist is never filtered by completion/submission status -- it renders every item the catalog returns", () => {
  assert.match(SOURCE, /\{catalog\.lessons\.map\(\(lesson\) => \(/);
  assert.match(SOURCE, /\{catalog\.activities\.map\(\(activity\) => \(/);
  assert.doesNotMatch(SOURCE, /catalog\.lessons\.filter/);
  assert.doesNotMatch(SOURCE, /catalog\.activities\.filter/);
});

test("the enrolled-learner list is scoped to the selected subject via the real API, never a client-side filter of an unrelated global list", () => {
  assert.match(SOURCE, /fetch\(`\/api\/teacher\/reports\/learners\?subjectId=\$\{subjectId\}`\)/);
});

test("generating a preview with zero selected lessons AND zero selected activities is blocked with a clear message before any fetch", () => {
  const fn = SOURCE.match(/async function generatePreview\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(fn, "generatePreview not found");
  assert.match(fn!, /selectedLessonIds\.size === 0 && selectedActivityIds\.size === 0/);
  const guardIndex = fn!.indexOf("selectedLessonIds.size === 0");
  const fetchIndex = fn!.indexOf('fetch("/api/teacher/reports/preview"');
  assert.ok(guardIndex > -1 && fetchIndex > -1 && guardIndex < fetchIndex);
});

test("the preview call passes the teacher's exact selected ID arrays -- never the full catalog, never a re-derived subset", () => {
  const fn = SOURCE.match(/async function generatePreview\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(fn);
  assert.match(fn!, /selectedLessonIds: \[\.\.\.selectedLessonIds\]/);
  assert.match(fn!, /selectedActivityIds: \[\.\.\.selectedActivityIds\]/);
});

test("Save Draft sends the exact same selected ID arrays as the preview call", () => {
  const fn = SOURCE.match(/async function saveDraft\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(fn, "saveDraft not found");
  assert.match(fn!, /selectedLessonIds: \[\.\.\.selectedLessonIds\]/);
  assert.match(fn!, /selectedActivityIds: \[\.\.\.selectedActivityIds\]/);
  assert.match(fn!, /fetch\("\/api\/teacher\/reports\/draft"/);
});

test("reopening an existing draft restores its selected lesson/activity IDs exactly as stored", () => {
  assert.match(SOURCE, /setSelectedLessonIds\(new Set\(draftData\.draft\.selected_lesson_ids\)\)/);
  assert.match(SOURCE, /setSelectedActivityIds\(new Set\(draftData\.draft\.selected_activity_ids\)\)/);
});

test("unticking a selected lesson never removes its linked activity -- only checking a lesson adds the convenience selection", () => {
  const toggleLessonFn = SOURCE.match(/function toggleLesson\(lessonId: string\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(toggleLessonFn, "toggleLesson not found");
  const uncheckBranch = toggleLessonFn!.split("next.add(lessonId);")[0];
  assert.doesNotMatch(uncheckBranch, /ActivityIds/);
});

test("no calculation is derived in this component -- values are only ever read from the report payload returned by the API", () => {
  assert.doesNotMatch(SOURCE, /earnedMarks \+|availableMarks \+/);
});

// AD ASTRA MONTHLY REPORT -- STAGE 4B: FINALISE & FREEZE.
//
// The stale-warning/Finalise-button/Finalised-indicator RENDERING logic
// itself now lives entirely in the extracted MonthlyReportFinaliseStatus
// component (components/teachers/MonthlyReportFinaliseStatus.tsx), whose
// own test file proves the mutual-exclusion invariant against REAL
// react-dom/server rendered output -- see that file's "INVARIANT" test.
// The tests here verify only the INTEGRATION point: that this component
// computes commentaryFreshness via the one shared, canonical
// deriveCommentaryFreshness function and passes it (plus every other
// required prop) to that single component, rather than re-implementing
// or duplicating any of that logic inline.
test("Finalise Report readiness is delegated entirely to the single extracted MonthlyReportFinaliseStatus component, imported from its own dedicated module", () => {
  assert.match(
    SOURCE,
    /import \{\s*\n\s*deriveCommentaryFreshness,\s*\n\s*MonthlyReportFinaliseStatus,\s*\n\s*\} from "@\/components\/teachers\/MonthlyReportFinaliseStatus";/,
  );
  assert.match(
    SOURCE,
    /const commentaryFreshness = deriveCommentaryFreshness\(Boolean\(displayedComments\), commentsStale\);/,
  );
  assert.match(SOURCE, /<MonthlyReportFinaliseStatus\s*\n\s*isFinalised=\{isFinalised\}\s*\n\s*finalisedAt=\{finalisedAt\}\s*\n\s*commentaryFreshness=\{commentaryFreshness\}\s*\n\s*finalizing=\{finalizing\}\s*\n\s*finalizeError=\{finalizeError\}\s*\n\s*onFinalize=\{\(\) => void finalizeReport\(\)\}\s*\n\s*\/>/);
  // There must be no leftover parallel implementation of the same
  // decision inline in this file -- exactly one component renders it.
  assert.doesNotMatch(SOURCE, /Finalise Report is unavailable until/);
  assert.doesNotMatch(SOURCE, /rounded-2xl border border-\[#102A43\]\/20 bg-\[#102A43\]\/5 p-4/);
});

test("Finalise Report requires explicit confirmation before calling the server", () => {
  const fn = SOURCE.match(/async function finalizeReport\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(fn, "finalizeReport not found");
  assert.match(fn!, /window\.confirm\(/);
  assert.match(fn!, /if \(!confirmed\) return;/);
  // The confirmation must appear BEFORE any network call.
  const confirmIndex = fn!.indexOf("window.confirm(");
  const fetchIndex = fn!.indexOf("fetch(");
  assert.ok(confirmIndex > -1 && fetchIndex > -1 && confirmIndex < fetchIndex);
});

test("the confirmation message clearly states the report becomes a frozen historical record that can no longer be edited or regenerated", () => {
  assert.match(SOURCE, /Once finalised, the report becomes the official record/);
  assert.match(SOURCE, /can no longer be edited or regenerated/);
});

test("finalizeReport calls the report-scoped finalize endpoint via POST with no request body, and folds the response back through the shared onDraftUpdated handler", () => {
  const fn = SOURCE.match(/async function finalizeReport\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(fn);
  assert.match(fn!, /fetch\(`\/api\/teacher\/reports\/\$\{draftId\}\/finalize`, \{\s*\n\s*method: "POST",\s*\n\s*\}\)/);
  assert.doesNotMatch(fn!, /body: JSON\.stringify/);
  assert.match(fn!, /onDraftUpdated\(data\.report\)/);
});

// AD ASTRA MONTHLY REPORT -- STAGE 4B BUGFIX: after regenerating Kingdom's
// commentary, the server recomputes report_snapshot BEFORE generating, so
// kingdom_comments.snapshotHash is produced against that fresh snapshot.
// If the client's displayed `preview` were left pointing at the OLDER
// snapshot from before regeneration, commentsStale would keep comparing
// stale local data against the new hash and could wrongly stay true
// forever, permanently hiding Finalise Report even after a successful
// regeneration. handleDraftUpdated must resync `preview` from EVERY
// mutating response's report_snapshot, not only on finalisation.
test("handleDraftUpdated resyncs the displayed preview from report_snapshot on EVERY mutating response (comments generated/regenerated, teacher edits saved, finalised) -- not gated on status === finalised", () => {
  const fn = SOURCE.match(/function handleDraftUpdated\([\s\S]*?\n  \}/)?.[0];
  assert.ok(fn, "handleDraftUpdated not found");
  assert.doesNotMatch(fn!, /updatedDraft\.status === "finalised" && updatedDraft\.report_snapshot/);
  assert.match(fn!, /if \(updatedDraft\.report_snapshot\) \{/);
  assert.match(fn!, /setPreview\(updatedDraft\.report_snapshot\);/);
});

test("regenerating Kingdom's commentary routes its response through the SAME onDraftUpdated handler that resyncs preview -- the fix applies to the exact path that was broken", () => {
  const generateFn = SOURCE.match(/async function generateComments\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(generateFn, "generateComments not found");
  assert.match(generateFn!, /onDraftUpdated\(data\.draft\);/);
});

// AD ASTRA MONTHLY REPORT -- HASH-MISMATCH INVESTIGATION FIX: the mutual-
// exclusion invariant itself (stale warning vs Finalise Report) is now
// proved against REAL rendered output in
// MonthlyReportFinaliseStatus.test.ts, not by regex here. What remains to
// verify in THIS file is that commentsStale (the raw signal
// deriveCommentaryFreshness consumes) is computed only from
// kingdomComments -- never from teacherEditedComments -- so a teacher-
// edited version can never itself cause or prevent freshness.
test("commentsStale (the input to the one canonical freshness derivation) is judged only against kingdomComments' own snapshotHash, never teacherEditedComments", () => {
  const commentsStaleDeclaration = SOURCE.match(/const commentsStale = Boolean\(\s*\n[\s\S]*?\n\s*\);/)?.[0];
  assert.ok(commentsStaleDeclaration, "commentsStale declaration not found");
  assert.match(commentsStaleDeclaration!, /kingdomComments\.snapshotHash !== hashMonthlyReportSnapshot\(report\)/);
  assert.doesNotMatch(commentsStaleDeclaration!, /teacherEditedComments/);
});

test("every draft-only control is disabled once the report is finalised: selection checkboxes, quick-select buttons, Generate Preview, Save Draft, and the entire commentary action row", () => {
  assert.match(SOURCE, /disabled=\{isFinalised\}/); // quick-select buttons and checkboxes share this exact prop
  assert.match(SOURCE, /disabled=\{!canGenerate \|\| previewLoading \|\| isFinalised\}/);
  assert.match(SOURCE, /disabled=\{saveState === "saving" \|\| isFinalised\}/);
  assert.match(SOURCE, /\{draftId && !isEditingComments && !isFinalised \? \(/);
});

test("a clear but restrained Finalised indicator is shown once the report is finalised -- MonthlyReportFinaliseStatus.test.ts proves it renders alone, with no Finalise button or stale warning alongside it", () => {
  assert.match(SOURCE, /isFinalised=\{isFinalised\}/);
});

test("server-side enforcement, not just the hidden UI, is what actually protects a finalised report -- the finalize route and repository re-validate independently of anything this component believes", () => {
  // This component never re-implements the finalisation preconditions
  // itself -- it only calls the server and reflects whatever comes back.
  assert.doesNotMatch(SOURCE, /snapshotHash !== .*kingdomComments|STALE_COMMENTARY|NO_KINGDOM_COMMENTS/);
});

// AD ASTRA MONTHLY REPORT -- STAGE 3: Kingdom commentary generation.
test("Kingdom commentary can only be generated against a SAVED draft, never an ephemeral preview", () => {
  assert.match(SOURCE, /draftId: string \| null/);
  assert.match(SOURCE, /Save this report as a draft before generating Kingdom commentary\./);
  assert.match(SOURCE, /if \(!draftId \|\| commentsLoading \|\| isFinalised\) return;/);
});

test("the generate/regenerate button disables itself while a request is in flight, preventing duplicate clicks", () => {
  assert.match(SOURCE, /disabled=\{commentsLoading\}/);
  assert.match(SOURCE, /commentsLoading\s*\n\s*\? "Generating…"/);
});

test("the button label switches from Generate to Regenerate once commentary already exists, per the locked regeneration-safety design", () => {
  assert.match(
    SOURCE,
    /kingdomComments\s*\n\s*\? "Regenerate Comments"\s*\n\s*: "Generate Report Comments"/,
  );
});

test("generateComments calls the report-scoped comments endpoint via POST and never sends client-computed statistics", () => {
  const fn = SOURCE.match(/async function generateComments\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(fn, "generateComments not found");
  assert.match(fn!, /fetch\(`\/api\/teacher\/reports\/\$\{draftId\}\/comments`, \{\s*\n\s*method: "POST",\s*\n\s*\}\)/);
  assert.doesNotMatch(fn!, /body: JSON\.stringify/);
});

test("stale commentary (report content changed since generation) is computed by comparing kingdomComments' stored hash against what's on screen right now", () => {
  assert.match(
    SOURCE,
    /kingdomComments\.snapshotHash !== hashMonthlyReportSnapshot\(report\)/,
  );
});

// AD ASTRA MONTHLY REPORT -- STAGE 4A: the polished preview renders
// whatever resolveDisplayedMonthlyReportComments resolved (teacher-edited
// if present, otherwise Kingdom's), never a hard-coded kingdomComments
// reference -- that centralised precedence is exactly the point.
test("all five sections (four paragraphs + priorities list) are rendered from the resolved displayed comments, never re-derived or hard-coded to kingdomComments directly", () => {
  assert.match(SOURCE, /displayedComments\.academicDevelopment/);
  assert.match(SOURCE, /displayedComments\.workEthicEngagement/);
  assert.match(SOURCE, /displayedComments\.examReadiness/);
  assert.match(SOURCE, /displayedComments\.generalProgress/);
  assert.match(SOURCE, /displayedComments\.prioritiesNextMonth\.map/);
});

test("the display precedence is centralised via resolveDisplayedMonthlyReportComments, never re-implemented ad hoc in the component", () => {
  assert.match(
    SOURCE,
    /const displayedComments = resolveDisplayedMonthlyReportComments\(\{\s*\n\s*kingdomComments,\s*\n\s*teacherEditedComments,\s*\n\s*\}\);/,
  );
});

test("Edit Report Comments is offered only once commentary already exists to edit", () => {
  assert.match(SOURCE, /\{displayedComments \? \(/);
  assert.match(SOURCE, /onClick=\{startEditingComments\}/);
  assert.match(SOURCE, />\s*Edit Report Comments\s*</);
});

test("starting an edit populates the draft from whatever is CURRENTLY displayed (teacher-edited if present, otherwise Kingdom's) -- never blank fields", () => {
  const fn = SOURCE.match(/function startEditingComments\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(fn, "startEditingComments not found");
  assert.match(fn!, /if \(!displayedComments \|\| isFinalised\) return;/);
  assert.match(fn!, /\.\.\.displayedComments,/);
});

test("Cancel discards local edits without any network call", () => {
  const fn = SOURCE.match(/function cancelEditingComments\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(fn, "cancelEditingComments not found");
  assert.doesNotMatch(fn!, /fetch\(/);
  assert.match(fn!, /setEditDraft\(null\);/);
  assert.match(fn!, /setIsEditingComments\(false\);/);
});

test("Save Changes persists the complete edited commentary to the report-scoped teacher-comments endpoint via POST with a JSON body, and never sends kingdom_comments", () => {
  const fn = SOURCE.match(/async function saveEditedComments\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(fn, "saveEditedComments not found");
  assert.match(fn!, /fetch\(`\/api\/teacher\/reports\/\$\{draftId\}\/teacher-comments`, \{/);
  assert.match(fn!, /method: "POST",/);
  assert.match(fn!, /body: JSON\.stringify\(editDraft\)/);
  assert.doesNotMatch(fn!, /kingdom_comments/);
});

test("after a successful save, the component returns to the normal polished preview rather than staying in the editing state", () => {
  const fn = SOURCE.match(/async function saveEditedComments\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(fn);
  assert.match(fn!, /setIsEditingComments\(false\);/);
});

test("regenerating Kingdom's commentary can never silently destroy teacher edits -- generateComments only ever updates state from the server's response, it never clears editDraft/teacherEditedComments itself", () => {
  const fn = SOURCE.match(/async function generateComments\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(fn, "generateComments not found");
  assert.doesNotMatch(fn!, /setEditDraft|teacherEditedComments:\s*null/);
});

test("the editor offers a way to intentionally load Kingdom's latest generated version into the local draft, only affecting unsaved state until Save Changes is clicked", () => {
  const fn = SOURCE.match(/function useLatestKingdomVersion\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(fn, "useLatestKingdomVersion not found");
  assert.match(fn!, /if \(!kingdomComments\) return;/);
  assert.match(fn!, /setEditDraft\(\{/);
  // Only rendered when both a Kingdom generation and a teacher-edited
  // version exist -- there is nothing to "reset to" otherwise.
  assert.match(SOURCE, /\{kingdomComments && teacherEditedComments \? \(/);
});

test("teacher-edited text passes through no client-side gendered-pronoun rejection -- that AI-specific safeguard is never applied to teacher-authored wording", () => {
  const saveFn = SOURCE.match(/async function saveEditedComments\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(saveFn);
  assert.doesNotMatch(saveFn!, /findProhibitedGenderedLanguage/);
  assert.doesNotMatch(SOURCE, /import.*findProhibitedGenderedLanguage/);
});

// AD ASTRA MONTHLY REPORT -- STAGE 4C BUGFIX: PUBLIC REPORT BADGE CRASH.
// The badge is resolved via the one canonical resolveMonthlyReportBadgeAsset
// function (lib/reports/monthlyReportBadgeAsset.ts) -- shared with the
// public report view -- never a direct BADGE_ASSET_BY_KEY lookup here,
// which previously assumed report.badge.key is always one of the three
// known keys and crashed when it wasn't.
test("the badge image is rendered from the deterministic payload's badge key via the canonical resolver, never recalculated or hard-coded to one tier", () => {
  assert.match(
    SOURCE,
    /import \{ resolveMonthlyReportBadgeAsset \} from "@\/lib\/reports\/monthlyReportBadgeAsset";/,
  );
  assert.match(SOURCE, /resolveMonthlyReportBadgeAsset\(report\.badge\?\.key\)/);
  assert.match(SOURCE, /import Image from "next\/image";/);
});

test("an unresolved (null) badge never crashes the teacher preview -- the badge image and label both render a safe fallback instead", () => {
  assert.match(SOURCE, /\{badge \? \(/);
  assert.match(SOURCE, /value=\{badge\?\.label \?\? "Not Available"\}/);
});

test("the report header shows Subject Teacher, never a Mentor Teacher field -- no mentor architecture exists", () => {
  assert.match(SOURCE, /Subject Teacher:/);
  assert.doesNotMatch(SOURCE, /[Mm]entor/);
});

test("no learner profile photograph is shown in the report preview", () => {
  assert.doesNotMatch(SOURCE, /profileImageUrl|profile_image_url|learner.*photo/i);
});

// AD ASTRA ACADEMIC AVERAGE MODEL CORRECTION -- report header redesign:
// the real AD Astra logo is now the large, centred primary brand anchor
// (never substituted, never stretched/cropped), not a small top-left mark.
// AD ASTRA MONTHLY REPORT -- COMPACT HEADER REFINEMENT: the header is a
// three-zone masthead (report info / logo / badge) on desktop -- a
// genuine 1fr/auto/1fr grid so the logo is centred on the WHOLE header,
// not merely the space left beside the text -- collapsing to a centred
// stack on narrow screens where there's no room for three columns.
test("the header lays out report info, logo, and badge as a genuine 1fr/auto/1fr grid on desktop, centring the logo on the whole header rather than the leftover space", () => {
  const headerBlock = SOURCE.match(
    /<div className="relative bg-\[#102A43\][\s\S]*?<\/div>\s*\n\s*<\/div>/,
  )?.[0];
  assert.ok(headerBlock, "report header block not found");
  assert.match(headerBlock!, /lg:grid lg:grid-cols-\[1fr_auto_1fr\]/);
  // Stacks centred on mobile/tablet -- never forces the three-column
  // desktop arrangement onto a narrow screen.
  assert.match(headerBlock!, /flex flex-col items-center gap-4 text-center/);
});

test("the header keeps the real AD Astra logo prominent (not shrunk to a tiny mark) while still being visibly more compact than a hero banner", () => {
  const headerBlock = SOURCE.match(
    /<div className="relative bg-\[#102A43\][\s\S]*?<\/div>\s*\n\s*<\/div>/,
  )?.[0];
  assert.ok(headerBlock, "report header block not found");
  assert.match(headerBlock!, /src="\/ad_astra_logo\.png"/);
  // object-contain (never object-cover/stretch) so the real asset's
  // aspect ratio is preserved; a real, visible size, not a tiny icon.
  assert.match(headerBlock!, /className="h-16 w-16 object-contain lg:h-20 lg:w-20"/);
});

test("the header's own vertical padding is compact, never a tall hero-banner amount", () => {
  assert.match(SOURCE, /bg-\[#102A43\] px-6 py-5 text-white lg:px-10 lg:py-6/);
});

test("the badge is balanced against the logo (visibly smaller) and right-aligned on desktop, never dominating the header", () => {
  const headerBlock = SOURCE.match(
    /<div className="relative bg-\[#102A43\][\s\S]*?<\/div>\s*\n\s*<\/div>/,
  )?.[0];
  assert.ok(headerBlock, "report header block not found");
  assert.match(headerBlock!, /flex justify-center lg:justify-end/);
  assert.match(headerBlock!, /className="h-14 w-14 object-contain drop-shadow-\[0_10px_28px_rgba\(0,0,0,0\.45\)\] lg:h-16 lg:w-16"/);
});

test("the header never substitutes a different/generated logo asset", () => {
  const logoSrcs = [...SOURCE.matchAll(/src="([^"]*logo[^"]*)"/gi)].map((m) => m[1]);
  assert.ok(logoSrcs.length > 0, "expected at least one logo <Image> in the component");
  for (const src of logoSrcs) {
    assert.equal(src, "/ad_astra_logo.png");
  }
});

// AD ASTRA ACADEMIC AVERAGE MODEL CORRECTION -- the "At a Glance" academic
// figure and its explanatory text must use the new equal-weight
// MonthlyReportAcademic shape, never the old marks-weighted fields this
// correction removed.
test("the At a Glance academic figure reads the new equal-weight academicPercentage, never the removed weightedPercentage field", () => {
  assert.match(SOURCE, /formatPercentage\(report\.academic\.academicPercentage\)/);
  assert.doesNotMatch(SOURCE, /\.weightedPercentage\b/);
  assert.doesNotMatch(SOURCE, /\.markedActivityCount\b/);
});

test("academicBasisSummary explains the result using the new effective/returned/overdue-missing counts", () => {
  const fn = SOURCE.match(/function academicBasisSummary\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "academicBasisSummary not found");
  assert.match(fn!, /effectiveActivityCount/);
  assert.match(fn!, /selectedActivityCount/);
  assert.match(fn!, /returnedActivityCount/);
  assert.match(fn!, /overdueMissingActivityCount/);
  assert.match(fn!, /academicPercentage === null/);
});

test("a provisional-result note is shown whenever any selected activity is awaiting teacher review", () => {
  assert.match(SOURCE, /report\.academic\.awaitingReviewActivityCount > 0/);
  assert.match(SOURCE, /Academic result is provisional because/);
});

// AD ASTRA ON-TIME WORK DISPLAY CORRECTION -- "On-Time Work" must show a
// volume (X of Y), never engagement.punctualityRate, which can read as a
// misleading 100% when almost every selected item is actually overdue
// and missing (its denominator silently excludes outstanding work).
test("formatOnTimeWork shows a volume, with a neutral message (never '0 / 0') when nothing selected was actually due", () => {
  const fn = SOURCE.match(/export function formatOnTimeWork\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "formatOnTimeWork not found");
  assert.match(fn!, /dueCount === 0/);
  assert.match(fn!, /\$\{completedCount\} \/ \$\{dueCount\}/);
});

test("the On-Time Work glance stat reads the new X/Y counts, never the old (misleading) punctualityRate", () => {
  assert.match(
    SOURCE,
    /formatOnTimeWork\(\s*\n\s*report\.engagement\.onTimeWorkCompletedCount,\s*\n\s*report\.engagement\.onTimeWorkDueCount,\s*\n\s*\)/,
  );
  assert.doesNotMatch(SOURCE, /label="On-Time Work"\s*\n\s*value=\{formatRate\(report\.engagement\.punctualityRate\)\}/);
});

// AD ASTRA MONTHLY REPORT -- STAGE 4C: PUBLIC REPORT LINK + EMAIL
// DELIVERY. "Send Progress Report" (MonthlyReportDelivery.tsx) must only
// ever be offered once a report is finalised -- draftId doubles as the
// finalised report's own id at that point, but the gate is isFinalised
// itself, not merely draftId being non-null (a draft also has a
// non-null draftId).
test("the delivery/send section is imported from its own dedicated module and rendered only once the report is finalised", () => {
  assert.match(
    SOURCE,
    /import \{ MonthlyReportDelivery \} from "@\/components\/teachers\/MonthlyReportDelivery";/,
  );
  assert.match(
    SOURCE,
    /\{isFinalised && draftId \? <MonthlyReportDelivery reportId=\{draftId\} \/> : null\}/,
  );
});

// AD ASTRA MONTHLY REPORT -- STAGE 4E: CREATE REPORT UX. A second official
// report for a learner/subject/reporting month that already has one must
// be detected as early as possible -- before the catalog is ever fetched
// or a preview generated -- not discovered only via a 409 at Finalise
// time.
test("the finalised-period check happens BEFORE the catalog is fetched or any preview is generated", () => {
  const effectFn = SOURCE.match(/useEffect\(\(\) => \{\s*\n\s*if \(!subjectId \|\| !learnerProfileId \|\| !reportMonthInput\) return;[\s\S]*?\}, \[subjectId, learnerProfileId, reportMonthInput\]\);/)?.[0];
  assert.ok(effectFn, "Step 3 effect not found");
  const draftCheckIndex = effectFn!.indexOf('fetch(\n          `/api/teacher/reports/draft?');
  const catalogFetchIndex = effectFn!.indexOf('fetch(`/api/teacher/reports/catalog?subjectId=');
  assert.ok(draftCheckIndex > -1 && catalogFetchIndex > -1);
  assert.ok(draftCheckIndex < catalogFetchIndex);
});

test("when the period already has a finalised report, the effect stops immediately -- it never fetches the catalog or generates a preview for that period", () => {
  const effectFn = SOURCE.match(/useEffect\(\(\) => \{\s*\n\s*if \(!subjectId \|\| !learnerProfileId \|\| !reportMonthInput\) return;[\s\S]*?\}, \[subjectId, learnerProfileId, reportMonthInput\]\);/)?.[0];
  assert.ok(effectFn);
  assert.match(
    effectFn!,
    /if \(draftData\.finalisedReportId\) \{\s*\n\s*setExistingFinalisedReportId\(draftData\.finalisedReportId\);\s*\n\s*return;\s*\n\s*\}/,
  );
});

test("the existing-finalised-report banner offers a direct, compact path to the report -- no second/duplicate creation flow is offered alongside it", () => {
  assert.match(SOURCE, /A finalised report already exists for this learner and reporting period\./);
  assert.match(SOURCE, /href=\{`\/teacher\/reports\/\$\{existingFinalisedReportId\}`\}/);
  assert.match(SOURCE, />\s*Open Finalised Report\s*</);
  // The content-selection section is explicitly gated OFF while an
  // existing finalised report is known -- never rendered alongside the
  // banner.
  assert.match(
    SOURCE,
    /\{subjectId && learnerProfileId && reportMonthInput && !existingFinalisedReportId \? \(/,
  );
});

test("existingFinalisedReportId is reset whenever the subject, learner, or reporting month changes -- a stale banner can never persist across a different selection", () => {
  const resetSubjectFn = SOURCE.match(/function resetDownstreamOfSubject\(\)[\s\S]*?\n  \}/)?.[0];
  const resetSelectionFn = SOURCE.match(/function resetDownstreamOfSelectionContext\(\)[\s\S]*?\n  \}/)?.[0];
  assert.ok(resetSubjectFn && resetSelectionFn);
  assert.match(resetSubjectFn!, /setExistingFinalisedReportId\(null\);/);
  assert.match(resetSelectionFn!, /setExistingFinalisedReportId\(null\);/);
});

test("GlanceStat and academicBasisSummary are exported for reuse by the public (unauthenticated) report view -- the same pure presentation logic must never be duplicated there", () => {
  assert.match(SOURCE, /export function GlanceStat\(/);
  assert.match(SOURCE, /export function academicBasisSummary\(/);
});

// AD ASTRA MONTHLY REPORT -- STAGE 4C BUGFIX: PUBLIC REPORT BADGE CRASH.
// Badge resolution is deliberately NOT exported/duplicated as a local
// BADGE_ASSET_BY_KEY map from this "use client" file any more -- it lives
// in its own plain module (lib/reports/monthlyReportBadgeAsset.ts) that
// both this component and the public report view import directly, so
// there is exactly one badge mapping and it works identically regardless
// of which side of a Server/Client Component boundary the caller is on.
test("badge resolution is centralised in its own plain module, never re-implemented locally as a BADGE_ASSET_BY_KEY map in this file", () => {
  assert.doesNotMatch(SOURCE, /BADGE_ASSET_BY_KEY/);
  assert.match(
    SOURCE,
    /import \{ resolveMonthlyReportBadgeAsset \} from "@\/lib\/reports\/monthlyReportBadgeAsset";/,
  );
});
