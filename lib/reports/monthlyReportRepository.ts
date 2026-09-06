import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { generateMonthlyReportPreview } from "@/lib/reports/monthlyReportEngine";
import { isMonthlyReportPayload } from "@/lib/reports/monthlyReportSnapshot";
import { hashMonthlyReportSnapshot } from "@/lib/reports/monthlyReportSnapshotHash";
import {
  resolveDisplayedMonthlyReportComments,
  validateMonthlyReportCommentsStructure,
  type StoredMonthlyReportKingdomComments,
  type StoredMonthlyReportTeacherEditedComments,
} from "@/lib/reports/kingdomMonthlyReport";
import type {
  MonthlyReportBadgeKey,
  MonthlyReportPayload,
} from "@/lib/reports/monthlyReportTypes";

// AD ASTRA MONTHLY LEARNER REPORT -- STAGE 1: draft persistence. No UI
// calls this yet; it exists so a future teacher-facing route has a single,
// well-named place to create/update/finalise a report rather than writing
// to monthly_reports directly. Every mutating function here uses a
// conditional `.eq("status", "draft")` update (mirroring the exact
// race-safe idempotency idiom already used for the review-return email
// claim in lib/email/reviewReturnEmail.ts) so a finalised report can never
// be silently overwritten by a late "regenerate from live data" call.

export type MonthlyReportRow = {
  id: string;
  learner_id: string;
  subject_id: string;
  teacher_id: string;
  report_month: string;
  status: "draft" | "finalised";
  selected_lesson_ids: string[];
  selected_activity_ids: string[];
  report_snapshot: MonthlyReportPayload | null;
  kingdom_comments: StoredMonthlyReportKingdomComments | null;
  teacher_edited_comments: StoredMonthlyReportTeacherEditedComments | null;
  badge: MonthlyReportBadgeKey | null;
  finalised_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getMonthlyReportById(
  reportId: string,
): Promise<MonthlyReportRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("monthly_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw error;
  return data as MonthlyReportRow | null;
}

// AD ASTRA MONTHLY REPORT -- STAGE 4D: TEACHER FINALISED REPORT ARCHIVE.
//
// The explicit, separate reader for reopening a FINALISED historical
// report -- deliberately not a relaxed findMonthlyReportDraft (which must
// stay draft-only, see its own header comment) and not a bare
// getMonthlyReportById call left to the caller to double-check. The
// "finalised" condition is enforced in the QUERY itself, not just in
// application code afterwards: a caller that forgets to check .status
// still gets null for a draft, never the row.
export async function findFinalisedMonthlyReportById(
  reportId: string,
): Promise<MonthlyReportRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("monthly_reports")
    .select("*")
    .eq("id", reportId)
    .eq("status", "finalised")
    .maybeSingle();
  if (error) throw error;
  return data as MonthlyReportRow | null;
}

// AD ASTRA MONTHLY REPORT -- STAGE 4E: CREATE REPORT UX. A lean lookup
// (id only -- never the full row) for the "does this exact learner/
// subject/reporting month already have an official finalised report"
// check the Create Report flow now runs as early as possible, before it
// ever fetches the catalog or generates a preview. Deliberately separate
// from hasFinalisedMonthlyReport (below) which only needs a boolean for
// the one-report-per-period guard -- this needs the id itself so the UI
// can link straight to it.
export async function findFinalisedMonthlyReportForPeriod({
  learnerId,
  subjectId,
  reportMonth,
}: {
  learnerId: string;
  subjectId: string;
  reportMonth: string;
}): Promise<{ id: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("monthly_reports")
    .select("id")
    .eq("learner_id", learnerId)
    .eq("subject_id", subjectId)
    .eq("report_month", reportMonth)
    .eq("status", "finalised")
    .maybeSingle();
  if (error) throw error;
  return data;
}

// AD ASTRA MONTHLY REPORT -- STAGE 4D: ONE-REPORT-PER-PERIOD GUARD.
//
// A real database investigation while building the Stage 4D archive found
// that this exact gap -- nothing stops a brand new draft being created for
// a learner/subject/reporting month that ALREADY has a finalised report --
// had already produced 3 finalised rows for one learner/subject/month in
// the live data (from repeated manual Stage 4C testing: finalise, then
// Save Draft again for the same period silently starts a second, entirely
// separate official record, because findMonthlyReportDraft correctly never
// matches a finalised row, so a fresh insert happens instead). A
// database-level partial unique index on (learner_id, subject_id,
// report_month) where status = 'finalised' would be the right long-term
// protection, but it CANNOT be safely added while those 3 conflicting
// rows already exist -- Postgres would refuse to build it, and this
// codebase's own convention is to report duplicates rather than delete or
// merge existing rows to force a constraint through. See this stage's
// report for the exact conflicting row IDs.
//
// Until that historical data is resolved and the index can be added, this
// guard is the forward-looking protection: it stops any FUTURE draft
// creation for a period that already has an official finalised report,
// without touching any existing row.
export class MonthlyReportPeriodAlreadyFinalisedError extends Error {
  constructor(
    message = "This learner already has a finalised report for this subject and reporting month.",
  ) {
    super(message);
    this.name = "MonthlyReportPeriodAlreadyFinalisedError";
  }
}

async function hasFinalisedMonthlyReport({
  learnerId,
  subjectId,
  reportMonth,
}: {
  learnerId: string;
  subjectId: string;
  reportMonth: string;
}): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("monthly_reports")
    .select("id")
    .eq("learner_id", learnerId)
    .eq("subject_id", subjectId)
    .eq("report_month", reportMonth)
    .eq("status", "finalised")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function listMonthlyReportsForLearnerSubject(
  learnerId: string,
  subjectId: string,
): Promise<MonthlyReportRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("monthly_reports")
    .select("*")
    .eq("learner_id", learnerId)
    .eq("subject_id", subjectId)
    .order("report_month", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MonthlyReportRow[];
}

// Finds an existing IN-PROGRESS draft for this exact learner+subject+
// reporting month, if one exists. A finalised report for the same period
// is deliberately never returned here -- it is a separate historical
// record, never reopened for editing (see saveMonthlyReportDraft below).
export async function findMonthlyReportDraft({
  learnerId,
  subjectId,
  reportMonth,
}: {
  learnerId: string;
  subjectId: string;
  reportMonth: string;
}): Promise<MonthlyReportRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("monthly_reports")
    .select("*")
    .eq("learner_id", learnerId)
    .eq("subject_id", subjectId)
    .eq("report_month", reportMonth)
    .eq("status", "draft")
    .maybeSingle();
  if (error) throw error;
  return data as MonthlyReportRow | null;
}

// The single entry point for "Save Draft": reuses an existing draft for
// this exact learner+subject+reporting month if one exists (updating its
// selection and snapshot in place) rather than creating a confusing
// duplicate, otherwise creates a fresh draft. A previously FINALISED
// report for the same period is left completely untouched -- this always
// creates or updates a NEW draft alongside it rather than ever touching a
// finalised row, matching the locked "finalised reports are immutable"
// rule.
export async function saveMonthlyReportDraft({
  learnerId,
  subjectId,
  teacherId,
  reportMonth,
  selectedLessonIds,
  selectedActivityIds,
}: {
  learnerId: string;
  subjectId: string;
  teacherId: string;
  reportMonth: string;
  selectedLessonIds: readonly string[];
  selectedActivityIds: readonly string[];
}): Promise<MonthlyReportRow> {
  const payload = await generateMonthlyReportPreview({
    learnerId,
    subjectId,
    teacherId,
    reportMonth,
    selectedLessonIds,
    selectedActivityIds,
  });

  const existingDraft = await findMonthlyReportDraft({
    learnerId,
    subjectId,
    reportMonth,
  });

  const supabase = createSupabaseAdminClient();

  if (existingDraft) {
    const { data, error } = await supabase
      .from("monthly_reports")
      .update({
        selected_lesson_ids: selectedLessonIds,
        selected_activity_ids: selectedActivityIds,
        report_snapshot: payload,
        badge: payload.badge.key,
      })
      .eq("id", existingDraft.id)
      .eq("status", "draft")
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new Error(
        "Cannot update this draft -- it was finalised by someone else moments ago.",
      );
    }
    return data as MonthlyReportRow;
  }

  // AD ASTRA MONTHLY REPORT -- STAGE 4D: only reached when no draft exists
  // for this exact period -- see MonthlyReportPeriodAlreadyFinalisedError's
  // header comment for why a fresh insert here must first confirm this
  // period isn't already officially finalised.
  if (await hasFinalisedMonthlyReport({ learnerId, subjectId, reportMonth })) {
    throw new MonthlyReportPeriodAlreadyFinalisedError();
  }

  const { data, error } = await supabase
    .from("monthly_reports")
    .insert({
      learner_id: learnerId,
      subject_id: subjectId,
      teacher_id: teacherId,
      report_month: reportMonth,
      status: "draft",
      selected_lesson_ids: selectedLessonIds,
      selected_activity_ids: selectedActivityIds,
      report_snapshot: payload,
      badge: payload.badge.key,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MonthlyReportRow;
}

export async function createMonthlyReportDraft({
  learnerId,
  subjectId,
  teacherId,
  reportMonth,
  selectedLessonIds,
  selectedActivityIds,
}: {
  learnerId: string;
  subjectId: string;
  teacherId: string;
  reportMonth: string;
  selectedLessonIds: readonly string[];
  selectedActivityIds: readonly string[];
}): Promise<MonthlyReportRow> {
  const payload = await generateMonthlyReportPreview({
    learnerId,
    subjectId,
    teacherId,
    reportMonth,
    selectedLessonIds,
    selectedActivityIds,
  });

  // AD ASTRA MONTHLY REPORT -- STAGE 4D: same guard as saveMonthlyReportDraft's
  // insert path -- see MonthlyReportPeriodAlreadyFinalisedError's header
  // comment. This function always inserts unconditionally, so it needs the
  // same check saveMonthlyReportDraft applies before its own insert.
  if (await hasFinalisedMonthlyReport({ learnerId, subjectId, reportMonth })) {
    throw new MonthlyReportPeriodAlreadyFinalisedError();
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("monthly_reports")
    .insert({
      learner_id: learnerId,
      subject_id: subjectId,
      teacher_id: teacherId,
      report_month: reportMonth,
      status: "draft",
      selected_lesson_ids: selectedLessonIds,
      selected_activity_ids: selectedActivityIds,
      report_snapshot: payload,
      badge: payload.badge.key,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MonthlyReportRow;
}

export async function updateMonthlyReportSelection(
  reportId: string,
  {
    selectedLessonIds,
    selectedActivityIds,
  }: { selectedLessonIds: readonly string[]; selectedActivityIds: readonly string[] },
): Promise<MonthlyReportRow> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("monthly_reports")
    .update({
      selected_lesson_ids: selectedLessonIds,
      selected_activity_ids: selectedActivityIds,
    })
    .eq("id", reportId)
    .eq("status", "draft")
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      "Cannot update selection: report not found, or it is already finalised.",
    );
  }
  return data as MonthlyReportRow;
}

// Recomputes the deterministic payload from current live data and stores
// it as the draft's latest preview. Only ever succeeds against a row
// still in "draft" status -- a finalised report's snapshot is frozen and
// this can never overwrite it (the conditional .eq("status", "draft")
// update simply matches zero rows against a finalised report, and that is
// treated as a hard error, not a silent no-op).
export async function recomputeMonthlyReportDraftSnapshot(
  reportId: string,
): Promise<MonthlyReportRow> {
  const existing = await getMonthlyReportById(reportId);
  if (!existing) throw new Error("Monthly report not found.");
  if (existing.status === "finalised") {
    throw new Error(
      "Cannot recompute a finalised report's snapshot -- finalised reports are immutable.",
    );
  }

  const payload = await generateMonthlyReportPreview({
    learnerId: existing.learner_id,
    subjectId: existing.subject_id,
    teacherId: existing.teacher_id,
    reportMonth: existing.report_month,
    selectedLessonIds: existing.selected_lesson_ids,
    selectedActivityIds: existing.selected_activity_ids,
  });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("monthly_reports")
    .update({ report_snapshot: payload, badge: payload.badge.key })
    .eq("id", reportId)
    .eq("status", "draft")
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      "Cannot recompute a finalised report's snapshot -- finalised reports are immutable.",
    );
  }
  return data as MonthlyReportRow;
}

// AD ASTRA MONTHLY REPORT -- STAGE 3: persists a Kingdom-generated
// commentary result to kingdom_comments. Draft-only (same conditional
// .eq("status", "draft") idempotency idiom used throughout this file) --
// a finalised report's kingdom_comments are frozen along with everything
// else about it, so a late "regenerate commentary" call can never mutate
// a finalised report. Never touches teacher_edited_comments: the original
// Kingdom generation and any later teacher-edited version (see
// saveMonthlyReportTeacherEditedComments below) are always stored
// separately, so regenerating Kingdom's commentary can never destroy a
// teacher's edited version, and editing can never mutate Kingdom's
// original generation.
export async function saveMonthlyReportKingdomComments(
  reportId: string,
  storedComments: StoredMonthlyReportKingdomComments,
): Promise<MonthlyReportRow> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("monthly_reports")
    .update({ kingdom_comments: storedComments })
    .eq("id", reportId)
    .eq("status", "draft")
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      "Cannot save Kingdom commentary: this report is no longer a draft (already finalised).",
    );
  }
  return data as MonthlyReportRow;
}

// AD ASTRA MONTHLY REPORT -- STAGE 4A: persists a teacher's reviewed/
// edited commentary to teacher_edited_comments. Draft-only, exactly like
// every other mutation here. Never touches kingdom_comments -- the
// original Kingdom generation is never mutated just because a teacher
// edited it (see this file's own header comment and
// saveMonthlyReportKingdomComments above for the reverse guarantee).
export async function saveMonthlyReportTeacherEditedComments(
  reportId: string,
  storedComments: StoredMonthlyReportTeacherEditedComments,
): Promise<MonthlyReportRow> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("monthly_reports")
    .update({ teacher_edited_comments: storedComments })
    .eq("id", reportId)
    .eq("status", "draft")
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      "Cannot save your changes: this report is no longer a draft (already finalised).",
    );
  }
  return data as MonthlyReportRow;
}

export type FinalizeMonthlyReportFailureCode =
  | "ALREADY_FINALISED"
  | "NO_KINGDOM_COMMENTS"
  | "STALE_COMMENTARY"
  | "INVALID_COMMENTS"
  | "INVALID_SNAPSHOT"
  | "CONCURRENT_FINALISATION"
  | "ALREADY_FINALISED_PERIOD";

export type FinalizeMonthlyReportResult =
  | { success: true; report: MonthlyReportRow }
  | { success: false; code: FinalizeMonthlyReportFailureCode; error: string };

// AD ASTRA MONTHLY REPORT -- STAGE 4B: FINALISE & FREEZE. Turns a
// teacher-reviewed draft into an immutable historical record.
//
// Recomputes the payload from LIVE data immediately before freezing --
// never trusts what the browser currently shows -- so the frozen facts
// reflect the learner's true position at the moment of finalisation, not
// a possibly-stale earlier preview. Rejects outright if the freshly
// recomputed snapshot's hash no longer matches the hash the CURRENT
// Kingdom generation (kingdom_comments.snapshotHash) was produced
// against: exactly the same staleness rule the teacher-facing preview UI
// already enforces (see MonthlyReportGenerator.tsx's own commentsStale),
// now enforced authoritatively server-side, where it actually matters,
// against fresh data rather than the row's last-saved snapshot.
//
// The approved commentary (teacher_edited_comments if present, otherwise
// kingdom_comments) is deliberately never copied into a new column: every
// write path to both columns is draft-only-gated (see
// saveMonthlyReportKingdomComments/saveMonthlyReportTeacherEditedComments
// above), so both become immutable the instant this function flips status
// to "finalised" below. resolveDisplayedMonthlyReportComments -- the same
// centralised precedence rule the draft preview UI already uses -- is
// exactly the right function to resolve "the approved commentary" again
// at render time for a finalised report. No duplicate storage needed.
export async function finalizeMonthlyReport(
  reportId: string,
): Promise<FinalizeMonthlyReportResult> {
  const existing = await getMonthlyReportById(reportId);
  if (!existing) {
    return {
      success: false,
      code: "CONCURRENT_FINALISATION",
      error: "Monthly report not found.",
    };
  }
  if (existing.status === "finalised") {
    return {
      success: false,
      code: "ALREADY_FINALISED",
      error: "This report is already finalised.",
    };
  }
  if (!existing.kingdom_comments) {
    return {
      success: false,
      code: "NO_KINGDOM_COMMENTS",
      error: "Generate Report Comments before finalising.",
    };
  }

  const payload = await generateMonthlyReportPreview({
    learnerId: existing.learner_id,
    subjectId: existing.subject_id,
    teacherId: existing.teacher_id,
    reportMonth: existing.report_month,
    selectedLessonIds: existing.selected_lesson_ids,
    selectedActivityIds: existing.selected_activity_ids,
  });

  if (!isMonthlyReportPayload(payload)) {
    return {
      success: false,
      code: "INVALID_SNAPSHOT",
      error: "Refusing to finalise: the generated report payload failed validation.",
    };
  }

  const currentSnapshotHash = hashMonthlyReportSnapshot(payload);
  if (existing.kingdom_comments.snapshotHash !== currentSnapshotHash) {
    return {
      success: false,
      code: "STALE_COMMENTARY",
      error:
        "This report's content has changed since Kingdom's commentary was generated. Regenerate Report Comments before finalising.",
    };
  }

  const approvedComments = resolveDisplayedMonthlyReportComments({
    kingdomComments: existing.kingdom_comments,
    teacherEditedComments: existing.teacher_edited_comments,
  });
  if (!approvedComments) {
    // Structurally unreachable (kingdom_comments was already confirmed
    // present above), but written as a real, safe guard rather than a
    // non-null assertion.
    return {
      success: false,
      code: "NO_KINGDOM_COMMENTS",
      error: "Generate Report Comments before finalising.",
    };
  }
  try {
    validateMonthlyReportCommentsStructure(approvedComments);
  } catch (validationError) {
    return {
      success: false,
      code: "INVALID_COMMENTS",
      error:
        validationError instanceof Error
          ? validationError.message
          : "The approved commentary failed validation.",
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("monthly_reports")
    .update({
      report_snapshot: payload,
      badge: payload.badge.key,
      status: "finalised",
      finalised_at: new Date().toISOString(),
    })
    .eq("id", reportId)
    .eq("status", "draft")
    .select()
    .maybeSingle();
  if (error) {
    // AD ASTRA MONTHLY REPORT -- STAGE 4E: RACE-CONDITION PROTECTION.
    // The Stage 4D application-level guard (hasFinalisedMonthlyReport,
    // checked much earlier in this same call against the read existing
    // draft's period) is only a friendly first layer -- it cannot see a
    // second finalisation for the SAME period that races past it and
    // finishes first. The database's own partial unique index
    // (monthly_reports_one_finalised_per_period, Stage 4E migration) is
    // the actual final authority: this UPDATE itself would violate that
    // index in that exact race, and Postgres reports it as a 23505 unique
    // violation. Converted here into a controlled, specific result rather
    // than the raw database error this function would otherwise throw --
    // finalisation atomicity is unchanged (this is still the single
    // .eq("status","draft")-gated update that already protects against a
    // draft finalised twice; this only adds a second index it can now
    // also collide with).
    if (error.code === "23505") {
      return {
        success: false,
        code: "ALREADY_FINALISED_PERIOD",
        error:
          "This learner already has a finalised report for this subject and reporting month.",
      };
    }
    throw error;
  }
  if (!data) {
    return {
      success: false,
      code: "CONCURRENT_FINALISATION",
      error: "Cannot finalise: this report is no longer a draft (already finalised).",
    };
  }
  return { success: true, report: data as MonthlyReportRow };
}
