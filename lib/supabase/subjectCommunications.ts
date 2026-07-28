import "server-only";

import type { AuthenticatedLearnerProfile } from "@/lib/learners/learnerProfile";
import type { AuthenticatedTeacherProfile } from "@/lib/teachers/teacherProfile";
import { getLearnerActivityStatus } from "@/lib/activities/learnerActivityStatus";
import { logSupabaseError } from "@/lib/supabase/errorDetails";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";

type SubjectEventRow = {
  id: string;
  subject_id: string;
  teacher_profile_id: string;
  title: string;
  description: string | null;
  event_date: string;
  created_at: string;
  updated_at: string;
};

type SubjectAnnouncementRow = {
  id: string;
  subject_id: string;
  teacher_profile_id: string;
  message: string;
  created_at: string;
  updated_at: string;
};

type LessonRow = {
  id: string;
  subject_id: string;
  title: string;
  expected_completion_date: string | null;
  status: string;
};

type LessonMaterialRow = {
  id: string;
  lesson_id: string;
  material_type: string;
};

type ActivityRow = {
  id: string;
  lesson_material_id: string;
  title: string;
  due_date: string | null;
  created_at: string;
};

type SubmissionRow = {
  activity_id: string;
  status: "submitted" | "marking_failed" | "awaiting_review" | "returned";
};

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

export type SubjectEventSummary = {
  id: string;
  subjectId: string;
  title: string;
  description: string | null;
  eventDate: string;
  displayDate?: string;
};

export type SubjectAnnouncementSummary = {
  id: string;
  subjectId: string;
  teacherProfileId: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  teacherName: string | null;
};

export type LearnerNext24HoursItem = {
  id: string;
  kind: "lesson" | "activity";
  title: string;
  subjectId: string;
  subjectName: string;
  href: string;
  scheduleLabel: string;
  sortAt: number;
};

export type LearnerHomeCommunications = {
  next24Hours: LearnerNext24HoursItem[];
  announcements: SubjectAnnouncementSummary[];
};

function startOfDayInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return new Date(
    `${values.year}-${values.month}-${values.day}T00:00:00+02:00`,
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDateLabel(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
}

function subjectName(subjectId: string) {
  return (
    getSubjectConfigurationByDatabaseId(subjectId)?.displayName ?? "Subject"
  );
}

function teacherName(row: TeacherProfileNameRow | undefined) {
  if (!row) return null;
  const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
  if (!profile) return row.faculty_name ?? null;

  const fullName = profile.full_name?.trim();
  if (fullName) return fullName;

  const composed = [profile.first_name?.trim(), profile.surname?.trim()]
    .filter(Boolean)
    .join(" ");
  return composed || row.faculty_name || null;
}

async function getTeacherNames(teacherProfileIds: string[]) {
  if (teacherProfileIds.length === 0) return new Map<string, string | null>();

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
    .in("id", teacherProfileIds);

  if (error) throw error;

  return new Map(
    ((data ?? []) as TeacherProfileNameRow[]).map((row) => [
      row.id,
      teacherName(row),
    ]),
  );
}

export async function getTeacherSubjectEvents(
  teacher: Pick<AuthenticatedTeacherProfile, "assignedSubjects"> | null,
  subjectId: string,
  now = new Date(),
) {
  if (teacher) {
    const hasAccess = teacher.assignedSubjects.some(
      (subject) => subject.id === subjectId,
    );
    if (!hasAccess) {
      throw new Error("Teacher access to this subject is required.");
    }
  }

  const supabase = createSupabaseAdminClient();
  const todayKey = startOfDayInTimeZone(now, "Africa/Johannesburg")
    .toISOString()
    .slice(0, 10);

  let { data, error } = await supabase
    .from("subject_events")
    .select(
      "id, subject_id, teacher_profile_id, title, description, event_date, created_at, updated_at",
    )
    .eq("subject_id", subjectId)
    .gte("event_date", todayKey)
    .order("event_date", { ascending: true });

  if (error?.code === "42703" || error?.code === "PGRST204") {
    logSupabaseError(
      "subject_events event_date query failed; the corrective date-only migration may not be applied yet:",
      error,
    );
    const legacyResult = await supabase
      .from("subject_events")
      .select(
        "id, subject_id, teacher_profile_id, title, description, event_at, created_at, updated_at",
      )
      .eq("subject_id", subjectId)
      .gte("event_at", `${todayKey}T00:00:00+02:00`)
      .order("event_at", { ascending: true });
    data = (legacyResult.data ?? []).map((event) => ({
      ...event,
      event_date: String(event.event_at).slice(0, 10),
    })) as typeof data;
    error = legacyResult.error;
  }

  if (error) throw error;

  return ((data ?? []) as SubjectEventRow[]).map((event) => ({
    id: event.id,
    subjectId: event.subject_id,
    title: event.title,
    description: event.description,
    eventDate: event.event_date,
  }));
}

export async function getTeacherSubjectAnnouncement(
  teacher: Pick<AuthenticatedTeacherProfile, "assignedSubjects"> | null,
  subjectId: string,
) {
  if (teacher) {
    const hasAccess = teacher.assignedSubjects.some(
      (subject) => subject.id === subjectId,
    );
    if (!hasAccess) {
      throw new Error("Teacher access to this subject is required.");
    }
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("subject_announcements")
    .select(
      "id, subject_id, teacher_profile_id, message, created_at, updated_at",
    )
    .eq("subject_id", subjectId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [namesByTeacher] = await Promise.all([
    getTeacherNames([data.teacher_profile_id]),
  ]);

  return {
    id: data.id,
    subjectId: data.subject_id,
    teacherProfileId: data.teacher_profile_id,
    message: data.message,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    teacherName: namesByTeacher.get(data.teacher_profile_id) ?? null,
  } satisfies SubjectAnnouncementSummary;
}

export async function getLearnerHomeCommunications(
  profile: AuthenticatedLearnerProfile,
  now = new Date(),
): Promise<LearnerHomeCommunications> {
  const subjectIds = profile.approvedSubjects.map((subject) => subject.id);
  if (subjectIds.length === 0) {
    return { next24Hours: [], announcements: [] };
  }

  const supabase = createSupabaseAdminClient();
  const todayStart = startOfDayInTimeZone(now, "Africa/Johannesburg");
  const tomorrowStart = addDays(todayStart, 1);
  const tomorrowKey = tomorrowStart.toISOString().slice(0, 10);
  const todayKey = todayStart.toISOString().slice(0, 10);
  const [lessonResult, announcementResult] = await Promise.all([
    supabase
      .from("lessons")
      .select("id, subject_id, title, expected_completion_date, status")
      .in("subject_id", subjectIds)
      .eq("status", "published")
      .not("expected_completion_date", "is", null)
      .in("expected_completion_date", [todayKey, tomorrowKey]),
    supabase
      .from("subject_announcements")
      .select(
        "id, subject_id, teacher_profile_id, message, created_at, updated_at",
      )
      .in("subject_id", subjectIds)
      .order("updated_at", { ascending: false }),
  ]);

  if (lessonResult.error) throw lessonResult.error;
  if (announcementResult.error) throw announcementResult.error;

  const lessons = (lessonResult.data ?? []) as LessonRow[];
  const lessonIds = lessons.map((lesson) => lesson.id);

  let activities: ActivityRow[] = [];
  let submissions: SubmissionRow[] = [];

  if (lessonIds.length > 0) {
    const { data: materialData, error: materialError } = await supabase
      .from("lesson_materials")
      .select("id, lesson_id, material_type")
      .in("lesson_id", lessonIds);

    if (materialError) throw materialError;

    const materials = (materialData ?? []) as LessonMaterialRow[];
    const activityMaterialIds = materials
      .filter((material) => material.material_type !== "quiz")
      .map((material) => material.id);
    const lessonIdByMaterialId = new Map(
      materials.map((material) => [material.id, material.lesson_id]),
    );

    if (activityMaterialIds.length > 0) {
      const { data: activityData, error: activityError } = await supabase
        .from("activities")
        .select("id, lesson_material_id, title, due_date, created_at")
        .in("lesson_material_id", activityMaterialIds)
        .not("due_date", "is", null)
        .in("due_date", [todayKey, tomorrowKey]);

      if (activityError) throw activityError;

      activities = (activityData ?? []) as ActivityRow[];
      if (activities.length > 0) {
        const { data: submissionData, error: submissionError } = await supabase
          .from("activity_submissions")
          .select("activity_id, status")
          .eq("learner_id", profile.userId)
          .in(
            "activity_id",
            activities.map((activity) => activity.id),
          );

        if (submissionError) throw submissionError;
        submissions = (submissionData ?? []) as SubmissionRow[];
      }
    }

    const submissionByActivityId = new Map(
      submissions.map((submission) => [submission.activity_id, submission]),
    );
    const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
    const next24Hours: LearnerNext24HoursItem[] = [];

    for (const lesson of lessons) {
      if (!lesson.expected_completion_date) continue;

      const lessonDate = new Date(`${lesson.expected_completion_date}T08:00:00+02:00`);
      next24Hours.push({
        id: lesson.id,
        kind: "lesson",
        title: lesson.title,
        subjectId: lesson.subject_id,
        subjectName: subjectName(lesson.subject_id),
        href: `${getSubjectConfigurationByDatabaseId(lesson.subject_id)?.routes.learnerClassroom ?? "/subjects"}?subject=${encodeURIComponent(lesson.subject_id)}`,
        scheduleLabel:
          lesson.expected_completion_date === todayKey
            ? "Due today"
            : "Due tomorrow",
        sortAt: lessonDate.getTime(),
      });
    }

    for (const activity of activities) {
      const submission = submissionByActivityId.get(activity.id);
      if (
        submission &&
        getLearnerActivityStatus({
          submissionStatus: submission.status,
          dueDate: activity.due_date,
          now,
        })
      ) {
        continue;
      }

      const lessonId = lessonIdByMaterialId.get(activity.lesson_material_id);
      const lesson = lessonId ? lessonById.get(lessonId) : null;
      if (!lesson || !activity.due_date) continue;

      const activityDate = new Date(`${activity.due_date}T18:00:00+02:00`);
      next24Hours.push({
        id: activity.id,
        kind: "activity",
        title: activity.title,
        subjectId: lesson.subject_id,
        subjectName: subjectName(lesson.subject_id),
        href: `${getSubjectConfigurationByDatabaseId(lesson.subject_id)?.routes.learnerActivities ?? "/subjects"}?subject=${encodeURIComponent(lesson.subject_id)}`,
        scheduleLabel:
          activity.due_date === todayKey ? "Due today" : "Due tomorrow",
        sortAt: activityDate.getTime(),
      });
    }

    const announcements = (announcementResult.data ?? []) as SubjectAnnouncementRow[];
    const namesByTeacher = await getTeacherNames(
      [...new Set(announcements.map((announcement) => announcement.teacher_profile_id))],
    );

    return {
      next24Hours: next24Hours.sort((itemA, itemB) => itemA.sortAt - itemB.sortAt),
      announcements: announcements.map((announcement) => ({
        id: announcement.id,
        subjectId: announcement.subject_id,
        teacherProfileId: announcement.teacher_profile_id,
        message: announcement.message,
        createdAt: announcement.created_at,
        updatedAt: announcement.updated_at,
        teacherName: namesByTeacher.get(announcement.teacher_profile_id) ?? null,
      })),
    };
  }

  const announcements = (announcementResult.data ?? []) as SubjectAnnouncementRow[];
  const namesByTeacher = await getTeacherNames(
    [...new Set(announcements.map((announcement) => announcement.teacher_profile_id))],
  );

  return {
    next24Hours: [],
    announcements: announcements.map((announcement) => ({
      id: announcement.id,
      subjectId: announcement.subject_id,
      teacherProfileId: announcement.teacher_profile_id,
      message: announcement.message,
      createdAt: announcement.created_at,
      updatedAt: announcement.updated_at,
      teacherName: namesByTeacher.get(announcement.teacher_profile_id) ?? null,
    })),
  };
}

export async function getLearnerSubjectEvents(
  profile: AuthenticatedLearnerProfile,
  subjectId: string,
  now = new Date(),
) {
  const hasAccess = profile.approvedSubjects.some(
    (subject) => subject.id === subjectId,
  );
  if (!hasAccess) return [];

  const supabase = createSupabaseAdminClient();
  const todayKey = startOfDayInTimeZone(now, "Africa/Johannesburg")
    .toISOString()
    .slice(0, 10);
  let { data, error } = await supabase
    .from("subject_events")
    .select(
      "id, subject_id, teacher_profile_id, title, description, event_date, created_at, updated_at",
    )
    .eq("subject_id", subjectId)
    .gte("event_date", todayKey)
    .order("event_date", { ascending: true })
    .limit(3);

  if (error?.code === "42703" || error?.code === "PGRST204") {
    logSupabaseError(
      "learner subject_events event_date query failed; the corrective date-only migration may not be applied yet:",
      error,
    );
    const legacyResult = await supabase
      .from("subject_events")
      .select(
        "id, subject_id, teacher_profile_id, title, description, event_at, created_at, updated_at",
      )
      .eq("subject_id", subjectId)
      .gte("event_at", `${todayKey}T00:00:00+02:00`)
      .order("event_at", { ascending: true })
      .limit(3);
    data = (legacyResult.data ?? []).map((event) => ({
      ...event,
      event_date: String(event.event_at).slice(0, 10),
    })) as typeof data;
    error = legacyResult.error;
  }

  if (error) throw error;

  return ((data ?? []) as SubjectEventRow[]).map((event) => ({
    id: event.id,
    subjectId: event.subject_id,
    title: event.title,
    description: event.description,
    eventDate: event.event_date,
    displayDate: formatDateLabel(event.event_date),
  }));
}
