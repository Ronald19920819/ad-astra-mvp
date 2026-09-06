import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { filterActivityBackedMaterialIds } from "@/lib/activities/activityBackedMaterial";

// AD ASTRA MONTHLY LEARNER REPORT -- STAGE 2: lean catalog reads for the
// teacher report generator's selection steps. Deliberately NOT reusing
// getSubjectLearningTracker (lib/supabase/learningTrackerReader.ts) here --
// that reader fetches every lesson's full video/reading/quiz progress for
// every learner in the subject just to list learner names, which is far
// more than a learner picker needs. This mirrors the same
// learner_subjects -> learner_profiles -> profiles join shape already
// used for that exact identity resolution in
// components/subjects/TeacherSubjectLearnerProfilePage.tsx's
// getLearnerIdentity, and in getSubjectLearningTracker's own cohort
// building -- not a new join pattern, just a lighter, purpose-built query.
//
// Everything else about a learner's per-item status (lesson completion,
// activity submission, lateness, marks) is deliberately NOT duplicated
// here -- the UI gets that by calling the real
// lib/reports/monthlyReportEngine.ts::generateMonthlyReportPreview with
// the full catalog of selectable IDs this file returns, exactly as it
// does for the teacher's final scoped selection. There is only ever one
// place that calculates report facts.

export type SubjectEnrolledLearner = {
  learnerProfileId: string;
  authUserId: string;
  name: string;
};

export async function getSubjectEnrolledLearnersForReports(
  subjectId: string,
): Promise<SubjectEnrolledLearner[]> {
  const supabase = createSupabaseAdminClient();

  let { data: enrolments, error: enrolmentsError } = await supabase
    .from("learner_subjects")
    .select("learner_profile_id")
    .eq("subject_id", subjectId)
    .eq("status", "approved")
    .eq("is_active", true);

  if (enrolmentsError?.code === "42703" || enrolmentsError?.code === "PGRST204") {
    const fallback = await supabase
      .from("learner_subjects")
      .select("learner_profile_id")
      .eq("subject_id", subjectId);
    enrolments = fallback.data;
    enrolmentsError = fallback.error;
  }
  if (enrolmentsError) throw enrolmentsError;

  const learnerProfileIds = [
    ...new Set((enrolments ?? []).map((row) => row.learner_profile_id)),
  ];
  if (learnerProfileIds.length === 0) return [];

  const { data: learnerProfiles, error: learnerProfilesError } = await supabase
    .from("learner_profiles")
    .select("id, profile_id")
    .eq("status", "active")
    .in("id", learnerProfileIds);
  if (learnerProfilesError) throw learnerProfilesError;

  const profileIds = (learnerProfiles ?? []).map((row) => row.profile_id);
  if (profileIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, auth_user_id, full_name")
    .eq("role", "learner")
    .in("id", profileIds);
  if (profilesError) throw profilesError;

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return (learnerProfiles ?? [])
    .flatMap((learnerProfile) => {
      const profile = profileById.get(learnerProfile.profile_id);
      if (!profile) return [];
      return [
        {
          learnerProfileId: learnerProfile.id,
          authUserId: profile.auth_user_id as string,
          name:
            typeof profile.full_name === "string" && profile.full_name.trim()
              ? profile.full_name.trim()
              : "Learner",
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Bridges the UI-facing learnerProfileId (the identifier every other
// teacher page in this codebase already uses -- see the [learnerId] route
// param convention in TeacherSubjectLearnerProfilePage.tsx) to the
// auth.users id the report engine and monthly_reports.learner_id require.
export async function resolveLearnerAuthUserId(
  learnerProfileId: string,
): Promise<string | null> {
  const supabase = createSupabaseAdminClient();

  const { data: learnerProfile, error: learnerProfileError } = await supabase
    .from("learner_profiles")
    .select("profile_id")
    .eq("id", learnerProfileId)
    .eq("status", "active")
    .maybeSingle();
  if (learnerProfileError) throw learnerProfileError;
  if (!learnerProfile) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("auth_user_id")
    .eq("id", learnerProfile.profile_id)
    .eq("role", "learner")
    .maybeSingle();
  if (profileError) throw profileError;
  return profile?.auth_user_id ?? null;
}

export type SubjectReportableCatalog = {
  lessonIds: string[];
  activityIds: string[];
};

// The full universe of selectable lessons/activities for a subject --
// every published lesson, and every proper graded activity (never a
// lesson quiz, via the same canonical filterActivityBackedMaterialIds
// already locked in for Stage 1). This is deliberately NOT filtered by
// any learner's completion/submission state -- outstanding work must
// remain selectable (Stage 2, locked requirement).
export async function getSubjectReportableCatalog(
  subjectId: string,
): Promise<SubjectReportableCatalog> {
  const supabase = createSupabaseAdminClient();

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id")
    .eq("subject_id", subjectId)
    .eq("status", "published");
  if (lessonsError) throw lessonsError;
  const lessonIds = (lessons ?? []).map((lesson) => lesson.id);
  if (lessonIds.length === 0) return { lessonIds: [], activityIds: [] };

  const { data: materials, error: materialsError } = await supabase
    .from("lesson_materials")
    .select("id, lesson_id, material_type")
    .in("lesson_id", lessonIds);
  if (materialsError) throw materialsError;

  const activityBackedMaterialIds = filterActivityBackedMaterialIds(materials ?? []);
  if (activityBackedMaterialIds.length === 0) {
    return { lessonIds, activityIds: [] };
  }

  const { data: activities, error: activitiesError } = await supabase
    .from("activities")
    .select("id")
    .in("lesson_material_id", activityBackedMaterialIds);
  if (activitiesError) throw activitiesError;

  return {
    lessonIds,
    activityIds: (activities ?? []).map((activity) => activity.id),
  };
}
