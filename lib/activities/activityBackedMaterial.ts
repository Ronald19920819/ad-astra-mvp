// Canonical predicate for "does this lesson material back a genuine
// learner activity" -- i.e. one a learner can actually submit to via
// activity_submissions. Quiz-type lesson_materials also have an associated
// `activities` row (used internally by the lesson-quiz flow, scored via
// learner_quiz_attempts instead), but a learner can never submit to it the
// way they submit to a real activity, so it must never be counted as one.
//
// Matches the filtering already used correctly by
// lib/supabase/businessStudiesLearnerOverview.ts,
// lib/supabase/learnerSubjectPageData.ts,
// lib/supabase/activityReviewReader.ts, and
// app/api/teacher/business-studies/activities/route.ts -- this module does
// not invent a new definition, it centralizes the existing correct one so
// it can't drift again.
export const ACTIVITY_BACKED_MATERIAL_TYPES = ["reading", "activity"] as const;

export type ActivityBackedMaterialType =
  (typeof ACTIVITY_BACKED_MATERIAL_TYPES)[number];

export function isActivityBackedMaterialType(
  materialType: string,
): materialType is ActivityBackedMaterialType {
  return (ACTIVITY_BACKED_MATERIAL_TYPES as readonly string[]).includes(
    materialType,
  );
}

export function filterActivityBackedMaterialIds(
  materials: readonly { id: string; material_type: string }[],
): string[] {
  return materials
    .filter((material) => isActivityBackedMaterialType(material.material_type))
    .map((material) => material.id);
}

// Given the full set of lesson materials and the full set of activities
// linked to any of them, returns only the activities backed by an eligible
// (non-quiz) material. Used directly by production readers where the
// activities were fetched without a materialIds pre-filter, and by tests to
// exercise the exact predicate without a live database.
export function filterActivityBackedActivities<
  T extends { lesson_material_id: string },
>(
  activities: readonly T[],
  materials: readonly { id: string; material_type: string }[],
): T[] {
  const eligibleMaterialIds = new Set(filterActivityBackedMaterialIds(materials));
  return activities.filter((activity) =>
    eligibleMaterialIds.has(activity.lesson_material_id),
  );
}
