import assert from "node:assert/strict";
import test from "node:test";

import { buildKingdomSubjectContext } from "@/lib/kingdom/subjectContext";
import {
  calculateEngagementSummary,
  calculateEvidenceFlags,
  calculateReportAcademicSummary,
  calculateTopicBreakdown,
} from "./monthlyReportCalculations";
import { calculateMonthlyReportBadge } from "./monthlyReportBadge";
import {
  buildKingdomMonthlyReportEvidence,
  buildKingdomMonthlyReportPrompt,
  findProhibitedGenderedLanguage,
  parseKingdomMonthlyReportComments,
  resolveDisplayedMonthlyReportComments,
  validateTeacherEditedMonthlyReportComments,
  type KingdomMonthlyReportComments,
  type StoredMonthlyReportKingdomComments,
  type StoredMonthlyReportTeacherEditedComments,
} from "./kingdomMonthlyReport";
import type {
  MonthlyReportActivityEntry,
  MonthlyReportLessonEntry,
  MonthlyReportPayload,
} from "./monthlyReportTypes";

// AD ASTRA MONTHLY REPORT -- STAGE 3: KINGDOM COMMENTARY.
//
// These tests exercise the PURE evidence-extraction/prompt-building/
// output-validation functions directly -- no OpenAI call is made
// anywhere here (that lives in the untested, server-only
// kingdomMonthlyReportGeneration.ts, matching the established precedent
// of lib/kingdom/examiner/businessStudiesActivity.ts).

function activity(overrides: Partial<MonthlyReportActivityEntry> = {}): MonthlyReportActivityEntry {
  return {
    activityId: "activity-1",
    lessonId: "lesson-1",
    lessonNumber: "3.1",
    title: "Activity 1",
    topicTitle: "Topic A",
    dueDate: "2026-08-04",
    dueDateBasis: "normal",
    submissionStatus: "returned",
    submittedAt: "2026-08-03T10:00:00.000Z",
    isLate: false,
    daysLate: 0,
    isOverdue: false,
    hasAuthoritativeMark: true,
    finalMark: 8,
    totalMarks: 10,
    percentage: 80,
    ...overrides,
  };
}

function overdueMissingActivity(
  overrides: Partial<MonthlyReportActivityEntry> = {},
): MonthlyReportActivityEntry {
  return activity({
    submissionStatus: "not_submitted",
    submittedAt: null,
    isLate: null,
    daysLate: null,
    isOverdue: true,
    hasAuthoritativeMark: false,
    finalMark: null,
    totalMarks: null,
    percentage: null,
    ...overrides,
  });
}

function notYetDueActivity(
  overrides: Partial<MonthlyReportActivityEntry> = {},
): MonthlyReportActivityEntry {
  return activity({
    submissionStatus: "not_submitted",
    submittedAt: null,
    isLate: null,
    daysLate: null,
    isOverdue: false,
    hasAuthoritativeMark: false,
    finalMark: null,
    totalMarks: null,
    percentage: null,
    ...overrides,
  });
}

function awaitingReviewActivity(
  overrides: Partial<MonthlyReportActivityEntry> = {},
): MonthlyReportActivityEntry {
  return activity({
    submissionStatus: "awaiting_review",
    hasAuthoritativeMark: false,
    finalMark: null,
    totalMarks: null,
    percentage: null,
    ...overrides,
  });
}

function lesson(overrides: Partial<MonthlyReportLessonEntry> = {}): MonthlyReportLessonEntry {
  return {
    lessonId: "lesson-1",
    lessonNumber: "3.1",
    title: "Lesson 3.1",
    topicTitle: "Topic A",
    dueDate: "2026-08-04",
    completedAt: "2026-08-03T10:00:00.000Z",
    status: "Complete",
    ...overrides,
  };
}

// Assembles a fully internally-consistent MonthlyReportPayload by running
// the REAL deterministic calculation functions over the given
// lessons/activities -- exactly mirroring how monthlyReportEngine.ts
// itself builds the payload (minus curriculum-order sorting, which is
// irrelevant here). This means these tests exercise the genuine
// integration between the report engine's own arithmetic and Kingdom's
// evidence extraction, rather than hand-typed (and potentially
// inconsistent) aggregate numbers.
function buildPayload({
  learnerName = "Ethan Petersen",
  subjectName = "Business Studies 0450 - IGCSE 2",
  reportMonth = "2026-08-01",
  lessons = [],
  activities = [],
}: {
  learnerName?: string;
  subjectName?: string;
  reportMonth?: string;
  lessons?: MonthlyReportLessonEntry[];
  activities?: MonthlyReportActivityEntry[];
}): MonthlyReportPayload {
  const academicBase = calculateReportAcademicSummary(activities);
  const topicBreakdown = calculateTopicBreakdown(activities);
  const engagement = calculateEngagementSummary(lessons, activities);
  const evidenceFlags = calculateEvidenceFlags({ activities, topicBreakdown, engagement });
  const badge = calculateMonthlyReportBadge({
    academicPercentage: academicBase.academicPercentage,
    combinedCompletionRate: engagement.completionRate,
    combinedPunctualityRate: engagement.punctualityRate,
    sufficientEvidence: !evidenceFlags.insufficientMarkedEvidence,
  });

  return {
    schemaVersion: 1,
    meta: {
      learnerId: "learner-1",
      learnerName,
      subjectId: "subject-1",
      subjectName,
      teacherId: "teacher-1",
      teacherName: "Ronald Petersen",
      reportMonth,
      generatedAt: "2026-09-01T00:00:00.000Z",
    },
    lessons,
    activities,
    academic: { ...academicBase, topicBreakdown },
    engagement,
    evidenceFlags,
    badge,
    attendance: null,
  };
}

const subjectContext = buildKingdomSubjectContext({
  subjectKey: "business-studies",
  role: "Analyst",
  taskType: "Generate monthly progress report commentary",
});

// ---------------------------------------------------------------------
// Scenario A -- Strong learner
// ---------------------------------------------------------------------
test("Scenario A (strong learner): evidence reflects high completion, sufficient returned work, a strong academic percentage, strong punctuality, and a defensible topic strength", () => {
  const lessons = Array.from({ length: 8 }, (_, index) =>
    lesson({ lessonId: `l${index}`, lessonNumber: `3.${index + 1}`, status: "Complete" }),
  );
  const activities = Array.from({ length: 8 }, (_, index) =>
    activity({
      activityId: `a${index}`,
      lessonNumber: `3.${index + 1}`,
      topicTitle: "Market Research",
      finalMark: 17,
      totalMarks: 20,
      percentage: 85,
      isLate: false,
      submittedAt: `2026-08-0${index + 1}T10:00:00.000Z`,
    }),
  );
  const payload = buildPayload({ lessons, activities });
  const evidence = buildKingdomMonthlyReportEvidence(payload);

  assert.equal(evidence.academicPercentage, 85);
  assert.equal(evidence.returnedActivityCount, 8);
  assert.equal(evidence.overdueMissingActivityCount, 0);
  assert.equal(evidence.lessonsCompleted, 8);
  assert.equal(evidence.punctualityRate, 1);
  assert.equal(evidence.insufficientMarkedEvidence, false);
  assert.equal(evidence.insufficientForTrend, false);
  assert.equal(evidence.topicBreakdown.length, 1);
  assert.equal(evidence.topicBreakdown[0]!.topicTitle, "Market Research");
  assert.equal(evidence.topicBreakdown[0]!.activityCount, 8);
  assert.equal(evidence.chronologicalResults.length, 8);
  // Chronological, ascending.
  assert.equal(evidence.chronologicalResults[0]!.submittedAt, "2026-08-01T10:00:00.000Z");
  assert.equal(payload.badge.key, "stellar");
});

// ---------------------------------------------------------------------
// Scenario B -- Strong marks, poor engagement
// ---------------------------------------------------------------------
test("Scenario B (strong marks, poor engagement): evidence surfaces both the genuine reviewed strength AND the substantial overdue/missing work, so commentary can make completion the main concern without denying the real marks", () => {
  const activities = [
    ...Array.from({ length: 4 }, (_, index) =>
      activity({ activityId: `returned-${index}`, finalMark: 18, totalMarks: 20, percentage: 90 }),
    ),
    ...Array.from({ length: 6 }, (_, index) => overdueMissingActivity({ activityId: `missing-${index}` })),
  ];
  const payload = buildPayload({ activities });
  const evidence = buildKingdomMonthlyReportEvidence(payload);

  assert.equal(evidence.returnedActivityCount, 4);
  assert.equal(evidence.overdueMissingActivityCount, 6);
  // The genuine reviewed strength is real and must remain visible...
  assert.ok(evidence.chronologicalResults.every((result) => result.percentage === 90));
  // ...even though the overall academic percentage is dragged down by
  // missing work, which is the completion problem commentary must lead
  // with, not a denial of the real marks.
  assert.equal(evidence.academicPercentage, 36); // (4*90 + 6*0) / 10
  assert.equal(evidence.substantialOutstandingWork, true);
});

// ---------------------------------------------------------------------
// Scenario C -- Very little evidence
// ---------------------------------------------------------------------
test("Scenario C (very little evidence): 1 returned + many overdue never implies broad academic weakness, and evidence flags force exam-readiness hedging", () => {
  const activities = [
    activity({ activityId: "returned-1", finalMark: 3.9, totalMarks: 10, percentage: 39 }),
    ...Array.from({ length: 9 }, (_, index) => overdueMissingActivity({ activityId: `missing-${index}` })),
  ];
  const payload = buildPayload({ activities });
  const evidence = buildKingdomMonthlyReportEvidence(payload);

  assert.equal(evidence.returnedActivityCount, 1);
  assert.equal(evidence.overdueMissingActivityCount, 9);
  assert.ok(Math.abs(evidence.academicPercentage! - 3.9) < 1e-9);
  assert.equal(evidence.insufficientMarkedEvidence, true); // 1 < 4
  assert.equal(evidence.insufficientForTrend, true); // 1 < 3
  assert.equal(payload.badge.key, "course_correction");

  // The prompt itself must carry the explicit safeguard against exactly
  // this misreading (a low percentage caused by missing work is not
  // proof of weak understanding), and must still force exam-readiness
  // hedging from low completion/insufficient evidence -- never from
  // punctuality, which this learner's fixture doesn't even touch.
  const prompt = buildKingdomMonthlyReportPrompt({ evidence, subjectContext });
  assert.match(prompt, /NOT proof of weak subject understanding/);
  assert.match(prompt, /EXAM READINESS --/);
  assert.match(prompt, /low completion is directly relevant here because large portions of the curriculum have not been completed or assessed/);
});

// ---------------------------------------------------------------------
// Scenario D -- Awaiting review
// ---------------------------------------------------------------------
test("Scenario D (awaiting review): submitted-but-unreviewed work is excluded from academic evidence but counted as submitted for engagement, and is never described as outstanding", () => {
  const activities = [
    activity({ activityId: "returned-1", percentage: 70 }),
    awaitingReviewActivity({ activityId: "pending-1" }),
    awaitingReviewActivity({ activityId: "pending-2" }),
  ];
  const payload = buildPayload({ activities });
  const evidence = buildKingdomMonthlyReportEvidence(payload);

  assert.equal(evidence.awaitingReviewActivityCount, 2);
  assert.equal(evidence.returnedActivityCount, 1);
  assert.equal(evidence.activitiesSubmitted, 3); // counts as submitted for engagement
  assert.equal(evidence.activitiesOutstanding, 0); // never outstanding
  assert.equal(evidence.unreviewedSubmissionsPresent, true);

  const prompt = buildKingdomMonthlyReportPrompt({ evidence, subjectContext });
  assert.match(prompt, /Never call them missing, outstanding, or overdue/);
});

// ---------------------------------------------------------------------
// Scenario E -- Not Yet Due
// ---------------------------------------------------------------------
test("Scenario E (Not Yet Due): future selected work causes no negative engagement or punctuality signal", () => {
  const activities = [
    activity({ activityId: "returned-1", percentage: 80 }),
    notYetDueActivity({ activityId: "future-1" }),
    notYetDueActivity({ activityId: "future-2" }),
  ];
  const lessons = [lesson({ lessonId: "l1", status: "Complete" }), lesson({ lessonId: "l2", status: "Incomplete" })];
  const payload = buildPayload({ lessons, activities });
  const evidence = buildKingdomMonthlyReportEvidence(payload);

  assert.equal(evidence.notYetDueActivityCount, 2);
  assert.equal(evidence.activitiesOutstanding, 0);
  assert.equal(evidence.overdueMissingActivityCount, 0);
  // Not-yet-due activities never enter the academic denominator either.
  assert.equal(evidence.effectiveActivityCount, 1);
  assert.equal(evidence.academicPercentage, 80);

  const prompt = buildKingdomMonthlyReportPrompt({ evidence, subjectContext });
  assert.match(prompt, /NOT YET DUE -- notYetDueActivityCount items were never due/);
});

test("the learner reference name is a first-name heuristic derived from the report's own learnerName, never a raw full-name repetition instruction", () => {
  const payload = buildPayload({ learnerName: "Ethan Petersen", activities: [] });
  const evidence = buildKingdomMonthlyReportEvidence(payload);
  assert.equal(evidence.learnerReferenceName, "Ethan");
});

test("a single-word learnerName is used as-is, never crashing on a missing surname", () => {
  const payload = buildPayload({ learnerName: "Learner", activities: [] });
  const evidence = buildKingdomMonthlyReportEvidence(payload);
  assert.equal(evidence.learnerReferenceName, "Learner");
});

test("chronologicalResults includes only genuinely authoritative (returned, marked) activities, sorted ascending by submission time", () => {
  const activities = [
    activity({ activityId: "a3", submittedAt: "2026-08-10T00:00:00.000Z", percentage: 60 }),
    activity({ activityId: "a1", submittedAt: "2026-08-01T00:00:00.000Z", percentage: 70 }),
    overdueMissingActivity({ activityId: "missing" }),
    awaitingReviewActivity({ activityId: "pending" }),
  ];
  const payload = buildPayload({ activities });
  const evidence = buildKingdomMonthlyReportEvidence(payload);

  assert.equal(evidence.chronologicalResults.length, 2);
  assert.equal(evidence.chronologicalResults[0]!.submittedAt, "2026-08-01T00:00:00.000Z");
  assert.equal(evidence.chronologicalResults[1]!.submittedAt, "2026-08-10T00:00:00.000Z");
});

// ---------------------------------------------------------------------
// Prompt safeguards
// ---------------------------------------------------------------------
test("the prompt always includes the hard evidence rule, the key distinction, gender-neutral hard rule, and tone guidance", () => {
  const payload = buildPayload({ activities: [activity()] });
  const evidence = buildKingdomMonthlyReportEvidence(payload);
  const prompt = buildKingdomMonthlyReportPrompt({ evidence, subjectContext });

  assert.match(prompt, /HARD EVIDENCE RULE/);
  assert.match(prompt, /Never invent marks, activity completion, due dates, attendance, behaviour/);
  assert.match(prompt, /KEY DISTINCTION/);
  assert.match(prompt, /GENDER-NEUTRAL LANGUAGE -- HARD RULE/);
  assert.match(prompt, /he, she, him, her, his, or hers/);
  assert.match(prompt, /TONE/);
  assert.match(prompt, /never "lazy" or similar/);
  assert.match(prompt, /Return JSON only/);
});

test("a retryReason is surfaced prominently at the top of the prompt when supplied, and omitted entirely otherwise", () => {
  const payload = buildPayload({ activities: [activity()] });
  const evidence = buildKingdomMonthlyReportEvidence(payload);

  const freshPrompt = buildKingdomMonthlyReportPrompt({ evidence, subjectContext });
  assert.doesNotMatch(freshPrompt, /YOUR PREVIOUS RESPONSE WAS REJECTED/);

  const retryPrompt = buildKingdomMonthlyReportPrompt({
    evidence,
    subjectContext,
    retryReason: 'The "examReadiness" section was missing, empty, or too long.',
  });
  assert.match(retryPrompt, /YOUR PREVIOUS RESPONSE WAS REJECTED: The "examReadiness" section/);
});

test("the evidence object itself is embedded in the prompt so Kingdom sees the exact same facts these tests assert on", () => {
  const payload = buildPayload({ activities: [activity({ percentage: 42 })] });
  const evidence = buildKingdomMonthlyReportEvidence(payload);
  const prompt = buildKingdomMonthlyReportPrompt({ evidence, subjectContext });
  assert.match(prompt, /"academicPercentage": 42/);
});

// ---------------------------------------------------------------------
// AD ASTRA BADGE & KINGDOM COMMENTARY RECALIBRATION -- punctuality is
// downgraded from a badge/exam-readiness gate to a supporting/diagnostic
// factor reported primarily in Work Ethic & Engagement.
// ---------------------------------------------------------------------
test("the report philosophy hierarchy is stated up front: academic primary, completion secondary, punctuality supporting/diagnostic only", () => {
  const payload = buildPayload({ activities: [activity()] });
  const evidence = buildKingdomMonthlyReportEvidence(payload);
  const prompt = buildKingdomMonthlyReportPrompt({ evidence, subjectContext });
  assert.match(prompt, /REPORT PHILOSOPHY -- LOCKED evidence hierarchy/);
  assert.match(prompt, /Academic Performance is PRIMARY/);
  assert.match(prompt, /Completion\/Engagement is SECONDARY/);
  assert.match(prompt, /Punctuality is SUPPORTING\/DIAGNOSTIC only/);
  assert.match(
    prompt,
    /never penalise the same non-completion a second time by treating punctuality as a further, separate failure/,
  );
});

test("punctuality is not a core Exam Readiness determinant, and lateness alone must never weaken an otherwise well-supported positive exam-readiness judgement", () => {
  const payload = buildPayload({ activities: [activity()] });
  const evidence = buildKingdomMonthlyReportEvidence(payload);
  const prompt = buildKingdomMonthlyReportPrompt({ evidence, subjectContext });
  assert.match(prompt, /Punctuality is NOT a core measure of academic exam readiness/);
  assert.match(
    prompt,
    /lateness alone must never weaken an otherwise well-supported positive judgement here/,
  );
});

test("punctuality is routed primarily to Work Ethic & Engagement, discussed only after completion/engagement is acknowledged", () => {
  const payload = buildPayload({ activities: [activity()] });
  const evidence = buildKingdomMonthlyReportEvidence(payload);
  const prompt = buildKingdomMonthlyReportPrompt({ evidence, subjectContext });
  assert.match(
    prompt,
    /punctuality should ordinarily be discussed substantively in workEthicEngagement ONLY/,
  );
  assert.match(
    prompt,
    /THE home for punctuality\. First acknowledge lesson completion and activity submission\/completion as patterns[\s\S]*?THEN discuss on-time work/,
  );
});

test("lateness is not repeated unnecessarily across Academic Development, Exam Readiness, or General Progress", () => {
  const payload = buildPayload({ activities: [activity()] });
  const evidence = buildKingdomMonthlyReportEvidence(payload);
  const prompt = buildKingdomMonthlyReportPrompt({ evidence, subjectContext });
  assert.match(
    prompt,
    /Do NOT repeat or reintroduce punctuality\/lateness in academicDevelopment, examReadiness, or generalProgress/,
  );
  assert.match(prompt, /Do not mention punctuality here \(see PUNCTUALITY PLACEMENT\)\./);
  assert.match(
    prompt,
    /not a repeat of the numbers, the workEthicEngagement paragraph, or punctuality concerns already covered there/,
  );
});

test("priorities are never automatically led by punctuality -- it's included only, and never first, when lateness is materially significant", () => {
  const payload = buildPayload({ activities: [activity()] });
  const evidence = buildKingdomMonthlyReportEvidence(payload);
  const prompt = buildKingdomMonthlyReportPrompt({ evidence, subjectContext });
  assert.match(
    prompt,
    /include punctuality only -- and never automatically first -- when lateness is materially significant/,
  );
});

test("terminology precision: lessons are completed, activities are marked/reviewed -- a perfect score is never attributed to a lesson", () => {
  const payload = buildPayload({ activities: [activity()] });
  const evidence = buildKingdomMonthlyReportEvidence(payload);
  const prompt = buildKingdomMonthlyReportPrompt({ evidence, subjectContext });
  assert.match(prompt, /TERMINOLOGY -- lessons are completed; activities \(assessments\) are reviewed\/marked/);
  assert.match(prompt, /never say "perfect scores in some lessons"/);
  assert.match(prompt, /say "perfect scores in some reviewed activities" or equivalent/);
});

test("natural, non-analytical language is required -- unnecessary reporting jargon is explicitly discouraged", () => {
  const payload = buildPayload({ activities: [activity()] });
  const evidence = buildKingdomMonthlyReportEvidence(payload);
  const prompt = buildKingdomMonthlyReportPrompt({ evidence, subjectContext });
  assert.match(prompt, /the way a subject teacher writes to a parent/);
  assert.match(prompt, /"comprehensive evidence base", "coverage gaps", or "assessment objectives"/);
});

// ---------------------------------------------------------------------
// Integrated Lisa-style / Ethan-style scenarios -- proving the real
// calculation pipeline (badge + evidence) together produce the expected
// outcome under the recalibrated rules.
// ---------------------------------------------------------------------
test("Lisa-style (84.7% academic, 10/10 lessons, 10/10 activities, 10 returned, substantial lateness): Stellar badge, and evidence still surfaces the lateness for Work Ethic without it touching the academic facts", () => {
  const lessons = Array.from({ length: 10 }, (_, index) =>
    lesson({ lessonId: `l${index}`, lessonNumber: `3.${index + 1}`, status: "Late" }),
  );
  const activities = Array.from({ length: 10 }, (_, index) =>
    activity({
      activityId: `a${index}`,
      lessonNumber: `3.${index + 1}`,
      topicTitle: index < 6 ? "Advanced Language Analysis" : "Multiple Perspectives and Narrative Voice",
      finalMark: 17,
      totalMarks: 20,
      percentage: 84.7,
      isLate: true,
      daysLate: 5,
      submittedAt: `2026-08-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
    }),
  );
  const payload = buildPayload({ learnerName: "Lisa Naidoo", lessons, activities });

  assert.equal(payload.badge.key, "stellar");
  assert.equal(payload.engagement.lessonCompletionRate, 1);
  assert.equal(payload.engagement.activitySubmissionRate, 1);
  assert.ok(payload.engagement.punctualityRate! < 0.2);

  const evidence = buildKingdomMonthlyReportEvidence(payload);
  assert.equal(evidence.returnedActivityCount, 10);
  assert.equal(evidence.onTimeWorkCompletedCount, 0);
  assert.equal(evidence.onTimeWorkDueCount, 20);
  assert.equal(evidence.topicBreakdown.length, 2);
});

test("Ethan-style (~3.9% academic, 2/10 lessons, 1/10 activities submitted, 1 returned, substantial overdue work): Course Correction badge, already justified without an additional punctuality penalty", () => {
  const lessons = [
    lesson({ lessonId: "l0", lessonNumber: "3.1", status: "Complete" }),
    lesson({ lessonId: "l1", lessonNumber: "3.2", status: "Complete" }),
    ...Array.from({ length: 8 }, (_, index) =>
      lesson({ lessonId: `l${index + 2}`, lessonNumber: `3.${index + 3}`, status: "Overdue" }),
    ),
  ];
  const activities = [
    activity({ activityId: "a0", finalMark: 3.9, totalMarks: 10, percentage: 39 }),
    ...Array.from({ length: 9 }, (_, index) => overdueMissingActivity({ activityId: `missing-${index}` })),
  ];
  const payload = buildPayload({ learnerName: "Ethan Petersen", lessons, activities });

  assert.equal(payload.badge.key, "course_correction");
  assert.ok(Math.abs(payload.academic.academicPercentage! - 3.9) < 1e-9);
  assert.equal(payload.evidenceFlags.insufficientMarkedEvidence, true);

  const evidence = buildKingdomMonthlyReportEvidence(payload);
  const prompt = buildKingdomMonthlyReportPrompt({ evidence, subjectContext });
  assert.match(prompt, /not yet enough evidence for a reliable judgement/);
});

// ---------------------------------------------------------------------
// Scenario F -- gender-language validator
// ---------------------------------------------------------------------
test("Scenario F: rejects every prohibited pronoun as a standalone word, case-insensitively", () => {
  assert.deepEqual(findProhibitedGenderedLanguage("He submitted the activity on time."), ["he"]);
  assert.deepEqual(findProhibitedGenderedLanguage("She has completed two lessons."), ["she"]);
  assert.deepEqual(findProhibitedGenderedLanguage("The teacher gave him feedback."), ["him"]);
  assert.deepEqual(findProhibitedGenderedLanguage("Her work was returned."), ["her"]);
  assert.deepEqual(findProhibitedGenderedLanguage("His activities remain outstanding."), ["his"]);
  assert.deepEqual(findProhibitedGenderedLanguage("This result is hers."), ["hers"]);
  assert.deepEqual(findProhibitedGenderedLanguage("HE and SHE both submitted."), ["he", "she"]);
});

test("Scenario F: never flags a prohibited word merely appearing as a substring of an unrelated word", () => {
  assert.deepEqual(findProhibitedGenderedLanguage("The teacher reviewed the activity."), []);
  assert.deepEqual(findProhibitedGenderedLanguage("This is a history topic."), []);
  assert.deepEqual(findProhibitedGenderedLanguage("The evidence gathered supports this."), []);
  assert.deepEqual(findProhibitedGenderedLanguage("The shell of the argument is sound."), []);
  assert.deepEqual(findProhibitedGenderedLanguage("A hermit crab example was used."), []);
  assert.deepEqual(
    findProhibitedGenderedLanguage("Ethan has completed two of the selected lessons."),
    [],
  );
});

// ---------------------------------------------------------------------
// Output validation (parseKingdomMonthlyReportComments)
// ---------------------------------------------------------------------
function validCommentsJson(overrides: Partial<KingdomMonthlyReportComments> = {}): string {
  const base: KingdomMonthlyReportComments = {
    academicDevelopment: "Ethan's reviewed result currently stands at 39%, based on one returned activity.",
    workEthicEngagement: "Completion has been inconsistent, with several activities remaining overdue.",
    examReadiness: "There is not yet enough reviewed evidence for a reliable judgement about exam readiness.",
    generalProgress: "The reporting period shows limited reviewed evidence and substantial outstanding work.",
    prioritiesNextMonth: ["Complete all overdue activities.", "Submit future work by its due date."],
    ...overrides,
  };
  return JSON.stringify(base);
}

test("parses a clean JSON response with no markdown fences", () => {
  const parsed = parseKingdomMonthlyReportComments(validCommentsJson());
  assert.equal(parsed.prioritiesNextMonth.length, 2);
  assert.equal(parsed.academicDevelopment.includes("39%"), true);
});

test("strips ```json fences before parsing", () => {
  const fenced = "```json\n" + validCommentsJson() + "\n```";
  const parsed = parseKingdomMonthlyReportComments(fenced);
  assert.equal(parsed.prioritiesNextMonth.length, 2);
});

test("rejects a response that is not valid JSON at all", () => {
  assert.throws(() => parseKingdomMonthlyReportComments("Sorry, I cannot help with that."), /not valid JSON/);
});

test("rejects a missing or empty paragraph field", () => {
  const raw = JSON.parse(validCommentsJson()) as Record<string, unknown>;
  raw.examReadiness = "";
  assert.throws(() => parseKingdomMonthlyReportComments(JSON.stringify(raw)), /"examReadiness" section/);
});

test("rejects a paragraph field that exceeds the maximum length", () => {
  const raw = JSON.parse(validCommentsJson()) as Record<string, unknown>;
  raw.generalProgress = "a".repeat(901);
  assert.throws(() => parseKingdomMonthlyReportComments(JSON.stringify(raw)), /"generalProgress" section/);
});

test("rejects fewer than 2 priorities", () => {
  assert.throws(
    () => parseKingdomMonthlyReportComments(validCommentsJson({ prioritiesNextMonth: ["Only one."] })),
    /prioritiesNextMonth/,
  );
});

test("rejects more than 3 priorities", () => {
  assert.throws(
    () =>
      parseKingdomMonthlyReportComments(
        validCommentsJson({ prioritiesNextMonth: ["One.", "Two.", "Three.", "Four."] }),
      ),
    /prioritiesNextMonth/,
  );
});

test("rejects a blank priority entry", () => {
  assert.throws(
    () => parseKingdomMonthlyReportComments(validCommentsJson({ prioritiesNextMonth: ["Real one.", "   "] })),
    /prioritiesNextMonth/,
  );
});

test("accepts exactly 3 priorities", () => {
  const parsed = parseKingdomMonthlyReportComments(
    validCommentsJson({ prioritiesNextMonth: ["One.", "Two.", "Three."] }),
  );
  assert.equal(parsed.prioritiesNextMonth.length, 3);
});

test("rejects a response containing a prohibited gendered pronoun anywhere, including inside a priority", () => {
  assert.throws(
    () =>
      parseKingdomMonthlyReportComments(
        validCommentsJson({ generalProgress: "He has made steady progress this month." }),
      ),
    /prohibited gendered language: he/,
  );
  assert.throws(
    () =>
      parseKingdomMonthlyReportComments(
        validCommentsJson({ prioritiesNextMonth: ["Encourage her to submit on time.", "Review topic gaps."] }),
      ),
    /prohibited gendered language: her/,
  );
});

test("gender-neutral phrasing using the learner's first name and 'the learner' passes validation cleanly", () => {
  const parsed = parseKingdomMonthlyReportComments(
    validCommentsJson({
      workEthicEngagement:
        "Ethan has completed two of the selected lessons. The learner needs more consistent engagement before a reliable judgement can be made.",
    }),
  );
  assert.match(parsed.workEthicEngagement, /Ethan/);
});

// ---------------------------------------------------------------------
// AD ASTRA MONTHLY REPORT -- STAGE 4A: TEACHER COMMENT REVIEW & EDITING.
// validateTeacherEditedMonthlyReportComments applies the same structural
// safety requirements as Kingdom's output, but deliberately never applies
// the gendered-language prohibition -- that exists to stop an AI from
// inferring the learner's gender, not to police a human teacher's own
// wording.
// ---------------------------------------------------------------------
function validCommentsObject(
  overrides: Partial<KingdomMonthlyReportComments> = {},
): KingdomMonthlyReportComments {
  return {
    academicDevelopment: "Lisa's reviewed work this period shows a strong overall standard.",
    workEthicEngagement: "Lisa completed all selected lessons and submitted every activity.",
    examReadiness: "Lisa demonstrates strong academic readiness based on the work completed.",
    generalProgress: "A positive reporting period overall, with strong reviewed results.",
    prioritiesNextMonth: ["Maintain the current standard of reviewed work.", "Continue building on strong topics."],
    ...overrides,
  };
}

test("accepts a well-formed teacher-edited object with no JSON string parsing required", () => {
  const comments = validateTeacherEditedMonthlyReportComments(validCommentsObject());
  assert.equal(comments.prioritiesNextMonth.length, 2);
  assert.match(comments.academicDevelopment, /Lisa/);
});

test("trims whitespace from every field, exactly like Kingdom's own validation", () => {
  const comments = validateTeacherEditedMonthlyReportComments(
    validCommentsObject({
      generalProgress: "   Extra whitespace around this sentence.   ",
      prioritiesNextMonth: ["  Trim me.  ", "Second priority."],
    }),
  );
  assert.equal(comments.generalProgress, "Extra whitespace around this sentence.");
  assert.equal(comments.prioritiesNextMonth[0], "Trim me.");
});

test("rejects an empty required section, exactly like Kingdom's validation", () => {
  assert.throws(
    () => validateTeacherEditedMonthlyReportComments(validCommentsObject({ examReadiness: "" })),
    /"examReadiness" section/,
  );
});

test("rejects fewer than 2 or more than 3 priorities, exactly like Kingdom's validation", () => {
  assert.throws(
    () => validateTeacherEditedMonthlyReportComments(validCommentsObject({ prioritiesNextMonth: ["Only one."] })),
    /prioritiesNextMonth/,
  );
  assert.throws(
    () =>
      validateTeacherEditedMonthlyReportComments(
        validCommentsObject({ prioritiesNextMonth: ["One.", "Two.", "Three.", "Four."] }),
      ),
    /prioritiesNextMonth/,
  );
});

test("does NOT reject a teacher's own use of he/she/him/her/his/hers -- the gendered-language prohibition is Kingdom-output-only", () => {
  const comments = validateTeacherEditedMonthlyReportComments(
    validCommentsObject({
      generalProgress: "He has made excellent progress this reporting period.",
      workEthicEngagement: "Her engagement with every selected lesson has been consistent.",
    }),
  );
  assert.match(comments.generalProgress, /^He has made/);
  assert.match(comments.workEthicEngagement, /^Her engagement/);
});

// ---------------------------------------------------------------------
// resolveDisplayedMonthlyReportComments -- the ONE centralised display-
// precedence rule.
// ---------------------------------------------------------------------
function storedKingdom(
  overrides: Partial<KingdomMonthlyReportComments> = {},
): StoredMonthlyReportKingdomComments {
  return {
    schemaVersion: 1,
    generatedAt: "2026-09-01T00:00:00.000Z",
    snapshotHash: "abcd1234",
    comments: validCommentsObject(overrides),
  };
}

function storedTeacherEdited(
  overrides: Partial<KingdomMonthlyReportComments> = {},
): StoredMonthlyReportTeacherEditedComments {
  return {
    schemaVersion: 1,
    editedAt: "2026-09-02T00:00:00.000Z",
    comments: validCommentsObject({ generalProgress: "Teacher-edited version.", ...overrides }),
  };
}

test("Kingdom comments exist, no teacher edits -> the Kingdom version is displayed", () => {
  const displayed = resolveDisplayedMonthlyReportComments({
    kingdomComments: storedKingdom(),
    teacherEditedComments: null,
  });
  assert.equal(displayed?.generalProgress, "A positive reporting period overall, with strong reviewed results.");
});

test("both exist -> the teacher-edited version takes precedence", () => {
  const displayed = resolveDisplayedMonthlyReportComments({
    kingdomComments: storedKingdom(),
    teacherEditedComments: storedTeacherEdited(),
  });
  assert.equal(displayed?.generalProgress, "Teacher-edited version.");
});

test("regenerating Kingdom's commentary never destroys a teacher's edits -- the teacher-edited version keeps displaying as the approved version even after kingdom_comments changes", () => {
  const freshlyRegeneratedKingdom = storedKingdom({ generalProgress: "A brand new Kingdom generation." });
  const displayed = resolveDisplayedMonthlyReportComments({
    kingdomComments: freshlyRegeneratedKingdom,
    teacherEditedComments: storedTeacherEdited(),
  });
  assert.equal(displayed?.generalProgress, "Teacher-edited version.");
});

test("neither exists -> null, never a fabricated placeholder", () => {
  const displayed = resolveDisplayedMonthlyReportComments({
    kingdomComments: null,
    teacherEditedComments: null,
  });
  assert.equal(displayed, null);
});
