// Phase 2 backfill: reconciles learners who already satisfied every
// adaptive completion requirement for a lesson (reading, if it exists;
// video, if it exists; quiz, if it exists) but have no
// learner_lesson_completions row -- most commonly because they finished
// everything before this evaluator existed, when completion required an
// extra manual "Complete Lesson" click that they never made.
//
// This does NOT invent a new completion rule: the STRICT path mirrors
// lib/lessons/adaptiveLessonCompletion.ts's evaluateAdaptiveLessonCompletion
// exactly (kept in sync manually, same convention already used by
// scripts/livekit-provision-test-ingress.mjs for small pure predicates in a
// plain .mjs script).
//
// This script ALSO contains a second, clearly separate LEGACY fallback
// path -- see "LEGACY READING FALLBACK" below -- that exists ONLY here. It
// is never added to the canonical helper, the completion service, any UI,
// or any normal API route: going forward, a lesson with a reading always
// requires the learner to explicitly mark it complete. The legacy fallback
// exists purely to reconcile a one-time historical gap: reading_completed_at
// did not exist before this migration, so it cannot penalize a learner who
// had already, genuinely, finished everything else that COULD be recorded
// at the time.
//
// Usage (dry run by default -- reports what WOULD change, writes nothing):
//   node scripts/reconcile-lesson-completions.mjs [--subject-id=<uuid>]
//   node scripts/reconcile-lesson-completions.mjs --include-legacy-reading-fallback
//
// Add --apply to actually persist:
//   node scripts/reconcile-lesson-completions.mjs --apply
//   node scripts/reconcile-lesson-completions.mjs --apply --include-legacy-reading-fallback
//
// The legacy fallback is NEVER evaluated, reported, or written unless
// --include-legacy-reading-fallback is explicitly passed -- ordinary strict
// reconciliation runs are unaffected by its existence.

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const VIDEO_COMPLETION_THRESHOLD_PERCENT = 90;

// Conservative pre-migration boundary: 202608190001_adaptive_lesson_completion.sql
// is dated 2026-08-19 by its own filename (this repo's migration naming
// convention is YYYYMMDDNNNN_description.sql). Midnight UTC at the start of
// that day is used as the cutoff -- any quiz attempt created before this
// instant could not possibly have been influenced by the new
// reading-completion flow, so it is unambiguously historical. Anything
// created on/after this instant is treated as post-migration and is never
// eligible for the legacy fallback, protecting against a future run of
// this script misclassifying a genuinely new quiz pass as historical.
const LEGACY_BOUNDARY_TIMESTAMP = "2026-08-19T00:00:00.000Z";

// Keep in sync with lib/subjects/subjectConfig.ts -- used only to make the
// legacy audit printout human-readable, not for any decision logic.
const SUBJECT_KEY_BY_ID = {
  "c472f3c9-0e6f-40de-a748-3ad9400ac069": "business-studies",
  "7d6c9b24-7d9a-4f8b-9c4c-7f6d1e3a0b11": "business-studies-igcse-1",
  "0d0f5c7f-23c6-4022-a5c3-f6e1c779b681": "english",
  "9f2a6c13-3d7e-4f1b-8c55-4b8c7d6e2f33": "english-stage-8",
  "e26c1112-3627-4a56-8f6a-4eab5d209b23": "afrikaans",
  "a03b7d24-4e8f-4a2c-9d66-5c9d8e7f3044": "afrikaans-stage-8",
  "dca2600c-932f-46bf-904c-a99be158e7f0": "history",
  "8e1f5b92-2b6c-4e0c-9d44-3a7b6c5d1e22": "history-igcse-1",
};

// Mirrors lib/lessons/adaptiveLessonCompletion.ts::evaluateAdaptiveLessonCompletion,
// plus a `missingTypes` field (not present on the canonical helper) used
// only for this script's diagnostic categorization below.
function evaluateAdaptiveLessonCompletion(availability, signals) {
  const requiredTypes = [];
  const satisfiedTypes = [];

  if (availability.hasReading) {
    requiredTypes.push("reading");
    if (signals.isReadingComplete) satisfiedTypes.push("reading");
  }
  if (availability.hasVideo) {
    requiredTypes.push("video");
    if (signals.isVideoComplete) satisfiedTypes.push("video");
  }
  if (availability.hasQuiz) {
    requiredTypes.push("quiz");
    if (signals.isQuizPassed) satisfiedTypes.push("quiz");
  }

  return {
    requiredTypes,
    satisfiedTypes,
    isComplete: requiredTypes.length > 0 && satisfiedTypes.length === requiredTypes.length,
    missingTypes: requiredTypes.filter((type) => !satisfiedTypes.includes(type)),
  };
}

function parseCliArgs(argv) {
  const args = { apply: false, includeLegacyReadingFallback: false };
  for (const raw of argv) {
    if (raw === "--apply") {
      args.apply = true;
      continue;
    }
    if (raw === "--include-legacy-reading-fallback") {
      args.includeLegacyReadingFallback = true;
      continue;
    }
    const match = /^--([a-zA-Z-]+)=(.*)$/.exec(raw);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

const cliArgs = parseCliArgs(process.argv.slice(2));

const rootDir = process.cwd();
for (const fileName of [".env.local", ".env"]) {
  const filePath = path.join(rootDir, fileName);
  if (!fs.existsSync(filePath)) continue;
  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;
    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.info(cliArgs.apply ? "Running in APPLY mode -- will write completions." : "Running in DRY RUN mode -- no writes will be made (pass --apply to persist).");
if (cliArgs["subject-id"]) {
  console.info(`Scoped to subject: ${cliArgs["subject-id"]}`);
}
if (cliArgs.includeLegacyReadingFallback) {
  console.info(
    `Legacy reading fallback ENABLED -- boundary: attempts before ${LEGACY_BOUNDARY_TIMESTAMP} are eligible.`,
  );
} else {
  console.info("Legacy reading fallback disabled (pass --include-legacy-reading-fallback to enable).");
}

let lessonQuery = supabase
  .from("lessons")
  .select("id, subject_id, title, expected_completion_date")
  .eq("status", "published");
if (cliArgs["subject-id"]) {
  lessonQuery = lessonQuery.eq("subject_id", cliArgs["subject-id"]);
}

const { data: lessons, error: lessonsError } = await lessonQuery;
if (lessonsError) throw lessonsError;

if (!lessons || lessons.length === 0) {
  console.info("No published lessons found for the given scope.");
  process.exit(0);
}

const lessonIds = lessons.map((lesson) => lesson.id);
const subjectIds = [...new Set(lessons.map((lesson) => lesson.subject_id))];

const [materialsResult, enrolmentsResult, completionsResult] = await Promise.all([
  supabase.from("lesson_materials").select("id, lesson_id, material_type").in("lesson_id", lessonIds),
  supabase
    .from("learner_subjects")
    .select("learner_profile_id, subject_id")
    .in("subject_id", subjectIds)
    .eq("status", "approved")
    .eq("is_active", true),
  supabase.from("learner_lesson_completions").select("learner_id, lesson_id").in("lesson_id", lessonIds),
]);

if (materialsResult.error) throw materialsResult.error;
if (enrolmentsResult.error) throw enrolmentsResult.error;
if (completionsResult.error) throw completionsResult.error;

const materials = materialsResult.data ?? [];
const enrolments = enrolmentsResult.data ?? [];
const existingCompletions = completionsResult.data ?? [];

const learnerProfileIds = [...new Set(enrolments.map((row) => row.learner_profile_id))];

const { data: learnerProfiles, error: learnerProfilesError } = await supabase
  .from("learner_profiles")
  .select("id, profile_id")
  .eq("status", "active")
  .in("id", learnerProfileIds);
if (learnerProfilesError) throw learnerProfilesError;

const profileIds = (learnerProfiles ?? []).map((row) => row.profile_id);
const { data: profiles, error: profilesError } = await supabase
  .from("profiles")
  .select("id, auth_user_id, full_name")
  .eq("role", "learner")
  .in("id", profileIds);
if (profilesError) throw profilesError;

const authUserIdByProfileId = new Map((profiles ?? []).map((row) => [row.id, row.auth_user_id]));
const nameByAuthUserId = new Map((profiles ?? []).map((row) => [row.auth_user_id, row.full_name]));
const authUserIdByLearnerProfileId = new Map(
  (learnerProfiles ?? []).flatMap((row) => {
    const authUserId = authUserIdByProfileId.get(row.profile_id);
    return authUserId ? [[row.id, authUserId]] : [];
  }),
);

const learnerProfileIdsBySubject = new Map();
for (const enrolment of enrolments) {
  const list = learnerProfileIdsBySubject.get(enrolment.subject_id) ?? [];
  list.push(enrolment.learner_profile_id);
  learnerProfileIdsBySubject.set(enrolment.subject_id, list);
}

const materialsByLesson = new Map();
for (const material of materials) {
  const list = materialsByLesson.get(material.lesson_id) ?? [];
  list.push(material);
  materialsByLesson.set(material.lesson_id, list);
}

const existingCompletionKeys = new Set(
  existingCompletions.map((row) => `${row.lesson_id}:${row.learner_id}`),
);

const allAuthUserIds = [...new Set([...authUserIdByLearnerProfileId.values()])];

// Note: attempts are fetched WITHOUT filtering to passed=true, unlike the
// canonical evaluator's own query -- this script additionally needs to
// distinguish "attempted but never passed" from "never attempted at all"
// for the legacy-evidence breakdown below (the canonical isComplete
// decision itself still only ever counts a PASSED attempt).
const [progressResult, attemptsResult] = await Promise.all([
  supabase
    .from("learner_lesson_progress")
    .select(
      "learner_profile_id, lesson_id, video_progress_percent, video_updated_at, reading_completed_at, video_started_at, last_engaged_at",
    )
    .in("lesson_id", lessonIds),
  allAuthUserIds.length > 0
    ? supabase
        .from("learner_quiz_attempts")
        .select("learner_id, lesson_id, quiz_score, quiz_total, passed, created_at")
        .in("lesson_id", lessonIds)
        .in("learner_id", allAuthUserIds)
    : Promise.resolve({ data: [], error: null }),
]);

if (progressResult.error) throw progressResult.error;
if (attemptsResult.error) throw attemptsResult.error;

const progressByKey = new Map(
  (progressResult.data ?? []).map((row) => [`${row.lesson_id}:${row.learner_profile_id}`, row]),
);
const attemptsByKey = new Map();
for (const attempt of attemptsResult.data ?? []) {
  const key = `${attempt.lesson_id}:${attempt.learner_id}`;
  const list = attemptsByKey.get(key) ?? [];
  list.push(attempt);
  attemptsByKey.set(key, list);
}

function latestOf(timestamps) {
  const valid = timestamps.filter(Boolean);
  if (valid.length === 0) return null;
  return valid.reduce((latest, current) => (new Date(current) > new Date(latest) ? current : latest));
}

// Pure decision for the legacy reading fallback -- pulled out of the main
// loop so it has one obvious place to read and cite from a test. A pair is
// legacy-eligible only when: the flag is on, reading is the SOLE missing
// requirement (video/quiz, if required, are already genuinely satisfied),
// a passed quiz attempt exists, and that attempt predates the migration
// boundary.
function isLegacyFallbackEligible({
  includeLegacyReadingFallback,
  missingOnlyReading,
  passedAttempt,
  boundaryTimestamp,
}) {
  if (!includeLegacyReadingFallback || !missingOnlyReading || !passedAttempt) return false;
  return passedAttempt.created_at < boundaryTimestamp;
}

let evaluated = 0;
let alreadyComplete = 0;
let newlyEligible = 0;
let newlyEligibleViaLegacyFallback = 0;
let historicallyAmbiguousNotLegacyEligible = 0;
let genuinelyIncomplete = 0;
const legacyEvidence = {
  passedQuiz: 0,
  someEngagement: 0,
  noEvidence: 0,
};
const toInsert = [];
const legacyToInsert = [];
const legacyAuditRows = [];

for (const lesson of lessons) {
  const lessonMaterials = materialsByLesson.get(lesson.id) ?? [];
  const availability = {
    hasReading: lessonMaterials.some((m) => m.material_type === "reading"),
    hasVideo: lessonMaterials.some((m) => m.material_type === "video"),
    hasQuiz: lessonMaterials.some((m) => m.material_type === "quiz"),
  };

  const enrolledLearnerProfileIds = learnerProfileIdsBySubject.get(lesson.subject_id) ?? [];

  for (const learnerProfileId of enrolledLearnerProfileIds) {
    const authUserId = authUserIdByLearnerProfileId.get(learnerProfileId);
    if (!authUserId) continue;

    const key = `${lesson.id}:${authUserId}`;
    if (existingCompletionKeys.has(key)) {
      alreadyComplete += 1;
      continue;
    }

    evaluated += 1;
    const progress = progressByKey.get(`${lesson.id}:${learnerProfileId}`);
    const attempts = attemptsByKey.get(key) ?? [];
    const passedAttempt = attempts.find((attempt) => attempt.passed);

    const signals = {
      isReadingComplete: Boolean(progress?.reading_completed_at),
      isVideoComplete:
        Number(progress?.video_progress_percent ?? 0) >= VIDEO_COMPLETION_THRESHOLD_PERCENT,
      isQuizPassed: Boolean(passedAttempt),
    };

    const result = evaluateAdaptiveLessonCompletion(availability, signals);

    if (result.isComplete) {
      newlyEligible += 1;
      toInsert.push({
        learner_id: authUserId,
        lesson_id: lesson.id,
        completed_at: new Date().toISOString(),
        quiz_score: passedAttempt?.quiz_score ?? null,
      });
      continue;
    }

    // "Historically ambiguous" = reading is the ONLY unmet requirement --
    // video and quiz (whichever exist) are both already genuinely
    // satisfied. Anything missing video and/or quiz too is genuinely
    // incomplete regardless of the reading signal's history.
    const missingOnlyReading =
      result.missingTypes.length === 1 && result.missingTypes[0] === "reading";

    if (!missingOnlyReading) {
      genuinelyIncomplete += 1;
      continue;
    }

    // ===================== LEGACY READING FALLBACK =====================
    // Isolated to this script only -- see file header. Never evaluated
    // unless --include-legacy-reading-fallback is explicitly passed.
    const isPreMigration = Boolean(
      passedAttempt && passedAttempt.created_at < LEGACY_BOUNDARY_TIMESTAMP,
    );
    const legacyEligible = isLegacyFallbackEligible({
      includeLegacyReadingFallback: cliArgs.includeLegacyReadingFallback,
      missingOnlyReading,
      passedAttempt,
      boundaryTimestamp: LEGACY_BOUNDARY_TIMESTAMP,
    });

    if (legacyEligible) {
      newlyEligibleViaLegacyFallback += 1;
      legacyEvidence.passedQuiz += 1;

      // completed_at prefers the LATEST genuinely satisfied historical
      // requirement: the quiz-pass timestamp, or the video's last-updated
      // timestamp if video is required and was updated later. Never
      // today's date -- this is a historical record, and using "now"
      // would misrepresent it as on-time/late relative to the lesson's
      // expected_completion_date.
      const completedAt = latestOf([
        passedAttempt.created_at,
        availability.hasVideo ? progress?.video_updated_at : null,
      ]);

      legacyToInsert.push({
        learner_id: authUserId,
        lesson_id: lesson.id,
        completed_at: completedAt,
        quiz_score: passedAttempt.quiz_score,
      });

      legacyAuditRows.push({
        learnerProfileId,
        learnerName: nameByAuthUserId.get(authUserId) ?? "(name unavailable)",
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        subjectId: lesson.subject_id,
        subjectKey: SUBJECT_KEY_BY_ID[lesson.subject_id] ?? "(unknown subject key)",
        quizPassedAt: passedAttempt.created_at,
        chosenCompletedAt: completedAt,
        reason: "legacy reading signal missing; passed quiz confirms historical reading engagement",
      });
      continue;
    }

    // Missing reading only, but not (yet, or ever) legacy-eligible: either
    // the flag wasn't passed, there's no passed attempt, or the attempt is
    // recent enough to be a genuine post-migration case that should just
    // go through the normal "click Mark Reading Complete" flow.
    historicallyAmbiguousNotLegacyEligible += 1;
    if (passedAttempt) {
      // Passed a quiz, but the attempt doesn't qualify as legacy (either
      // the flag was off, or it's post-migration) -- still evidence, just
      // not actioned this run.
      if (!cliArgs.includeLegacyReadingFallback || isPreMigration) {
        legacyEvidence.passedQuiz += 1;
      }
    } else if (progress?.video_started_at || progress?.last_engaged_at || attempts.length > 0) {
      legacyEvidence.someEngagement += 1;
    } else {
      legacyEvidence.noEvidence += 1;
    }
  }
}

console.info("");
console.info("Reconciliation summary:", {
  lessonsScanned: lessons.length,
  learnerLessonPairsEvaluated: evaluated,
  alreadyCompleteViaExistingRow: alreadyComplete,
  newlyEligibleUnderStrictRule: newlyEligible,
  newlyEligibleViaLegacyReadingFallback: newlyEligibleViaLegacyFallback,
  historicallyAmbiguous_notLegacyEligibleThisRun: historicallyAmbiguousNotLegacyEligible,
  genuinelyIncomplete_missingVideoOrQuizToo: genuinelyIncomplete,
});
console.info("");
console.info(
  "Reading-only-gap evidence breakdown (includes both legacy-eligible and non-eligible this run):",
  legacyEvidence,
);

if (legacyAuditRows.length > 0) {
  console.info("");
  console.info(`Legacy-eligible pairs (${legacyAuditRows.length}) -- audit before ever approving --apply:`);
  for (const row of legacyAuditRows) {
    console.info("");
    console.info(`  learnerProfileId: ${row.learnerProfileId}`);
    console.info(`  learnerName:      ${row.learnerName}`);
    console.info(`  lessonId:         ${row.lessonId}`);
    console.info(`  lessonTitle:      ${row.lessonTitle}`);
    console.info(`  subjectId:        ${row.subjectId} (${row.subjectKey})`);
    console.info(`  quizPassedAt:     ${row.quizPassedAt}`);
    console.info(`  chosenCompletedAt:${row.chosenCompletedAt}`);
    console.info(`  reason:           ${row.reason}`);
  }
}

const totalEligibleToWrite = newlyEligible + (cliArgs.includeLegacyReadingFallback ? newlyEligibleViaLegacyFallback : 0);

if (totalEligibleToWrite === 0) {
  console.info("");
  console.info("Nothing eligible to reconcile under the currently-enabled rule(s).");
  process.exit(0);
}

if (!cliArgs.apply) {
  console.info("");
  console.info(
    `Dry run only -- ${newlyEligible} strict + ${cliArgs.includeLegacyReadingFallback ? newlyEligibleViaLegacyFallback : 0} legacy completion row(s) would be created. Re-run with --apply to persist.`,
  );
  process.exit(0);
}

const rowsToWrite = [...toInsert, ...(cliArgs.includeLegacyReadingFallback ? legacyToInsert : [])];

const { error: insertError } = await supabase
  .from("learner_lesson_completions")
  .upsert(rowsToWrite, { onConflict: "learner_id,lesson_id", ignoreDuplicates: true });

if (insertError) throw insertError;

console.info(`Persisted ${rowsToWrite.length} reconciled completion row(s).`);
