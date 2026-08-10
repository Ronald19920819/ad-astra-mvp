import "server-only";

import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type TeacherProfileNameRow = {
  id: string;
  faculty_name: string | null;
  profile:
    | {
        full_name: string | null;
        first_name?: string | null;
        surname?: string | null;
      }
    | {
        full_name: string | null;
        first_name?: string | null;
        surname?: string | null;
      }[]
    | null;
};

function isMissingColumnError(error: { code?: string } | null) {
  return error?.code === "42703" || error?.code === "PGRST204";
}

export function resolveTeacherDisplayName(row: TeacherProfileNameRow | undefined) {
  if (!row) return null;

  const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
  if (!profile) return row.faculty_name?.trim() || null;

  const fullName = profile.full_name?.trim();
  if (fullName) return fullName;

  const composed = [profile.first_name?.trim(), profile.surname?.trim()]
    .filter(Boolean)
    .join(" ");

  return composed || row.faculty_name?.trim() || null;
}

export const getTeacherNamesByProfileIds = cache(
  async (teacherProfileIds: readonly string[]) => {
    const uniqueTeacherProfileIds = [...new Set(teacherProfileIds)].filter(Boolean);
    if (uniqueTeacherProfileIds.length === 0) {
      return new Map<string, string | null>();
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("teacher_profiles")
      .select(
        `
        id,
        faculty_name,
        profile:profiles!teacher_profiles_profile_id_fkey(
          full_name,
          first_name,
          surname
        )
        `,
      )
      .in("id", uniqueTeacherProfileIds);

    if (error) throw error;

    return new Map(
      ((data ?? []) as TeacherProfileNameRow[]).map((row) => [
        row.id,
        resolveTeacherDisplayName(row),
      ]),
    );
  },
);

export const getSubjectTeacherNames = cache(async (subjectId: string) => {
  const supabase = createSupabaseAdminClient();

  let { data: assignments, error: assignmentError } = await supabase
    .from("teacher_subjects")
    .select("teacher_profile_id")
    .eq("subject_id", subjectId)
    .eq("status", "active");

  if (isMissingColumnError(assignmentError)) {
    const fallback = await supabase
      .from("teacher_subjects")
      .select("teacher_profile_id")
      .eq("subject_id", subjectId);
    assignments = fallback.data;
    assignmentError = fallback.error;
  }

  if (assignmentError) throw assignmentError;

  const teacherProfileIds = [...new Set((assignments ?? [])
    .map((assignment) => assignment.teacher_profile_id)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0))];

  if (teacherProfileIds.length === 0) {
    return [] as string[];
  }

  const namesByTeacher = await getTeacherNamesByProfileIds(teacherProfileIds);

  return teacherProfileIds
    .map((teacherProfileId) => namesByTeacher.get(teacherProfileId)?.trim() || null)
    .filter((name): name is string => Boolean(name))
    .sort((left, right) =>
      left.localeCompare(right, "en-ZA", { sensitivity: "base" }),
    );
});
