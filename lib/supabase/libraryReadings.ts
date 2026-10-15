import "server-only";

import { getAuthenticatedLearnerProfile } from "@/lib/supabase/learnerProfile";
import { verifyLearnerSubjectAccessForProfile } from "@/lib/supabase/subjectAccess";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getSubjectConfiguration,
  isSubjectKey,
  type SubjectColourTheme,
  type SubjectFamilyKey,
  type SubjectConfiguration,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";

// AD ASTRA -- LIBRARY CLUB (STAGE A): subject-scoped data foundation for
// "AD Astra -- Library Club", a permanent study/reference area, entirely
// separate from lesson progress/XP/Coins/activities. This reader returns
// ONLY metadata describing which published lessons in ONE exact,
// authorized subject currently have a canonical PDF reading attached --
// no storage path, no signed URL, no Supabase Storage call. View/Download
// (Stage D) will resolve the actual file access later, on demand, scoped
// to a single materialId re-verified against this same authorization
// chain.
//
// GENERAL FALLBACK, not "unknown-topic": a lesson with no subject_topics
// row is deliberately grouped under the literal label "General" here,
// never under its own lesson title -- Library Club is meant to read like
// a textbook index, and a per-lesson "topic" would defeat that.

const GENERAL_TOPIC_LABEL = "General";

export type LibraryClubSubject = {
  subjectId: string;
  subjectKey: SubjectKey;
  displayName: string;
  familyKey: SubjectFamilyKey;
  colourTheme: SubjectColourTheme;
};

export type LibraryClubLesson = {
  lessonId: string;
  materialId: string;
  lessonNumber: string;
  title: string;
  weekNumber: number | null;
};

export type LibraryClubTopic = {
  topicId: string | null;
  topicTitle: string;
  lessons: LibraryClubLesson[];
};

export type LibraryClubTerm = {
  termNumber: number | null;
  topics: LibraryClubTopic[];
};

export type LearnerLibraryForSubject = {
  subject: LibraryClubSubject;
  terms: LibraryClubTerm[];
};

export type LearnerLibraryForSubjectResult =
  | { status: "unauthenticated" }
  | { status: "unknown_subject" }
  | { status: "not_enrolled" }
  | { status: "ok"; library: LearnerLibraryForSubject };

// Raw PostgREST row shape for the single relational query below. This
// project has no generated Supabase Database types (confirmed: no reader
// in lib/supabase/*.ts imports one -- every embedded/nested select result
// is asserted to an explicit row type instead, e.g.
// activityReviewReader.ts's `as unknown as ActivityReviewRow[]`). The
// `topic` relation comes back as either a single object or a one-element
// array depending on how PostgREST resolves the embed, so both shapes are
// modelled and normalised below, matching the same normalisation already
// used in learnerSubjects.ts for the identical relation.
type LibraryLessonTopicRow = { id: string; title: string };

type LibraryLessonRow = {
  id: string;
  lesson_number: string;
  title: string;
  term_number: number | null;
  week_number: number | null;
  topic_id: string | null;
  topic: LibraryLessonTopicRow | LibraryLessonTopicRow[] | null;
  lesson_materials: { id: string }[];
};

function resolveTopicTitle(
  topic: LibraryLessonTopicRow | LibraryLessonTopicRow[] | null,
): string | null {
  const normalised = Array.isArray(topic) ? topic[0] : topic;
  return normalised?.title?.trim() || null;
}

function toLibraryClubSubject(
  subject: SubjectConfiguration,
): LibraryClubSubject {
  return {
    subjectId: subject.databaseId,
    subjectKey: subject.key,
    displayName: subject.displayName,
    familyKey: subject.familyKey,
    colourTheme: subject.colourTheme,
  };
}

function toLibraryClubLesson(row: LibraryLessonRow): LibraryClubLesson {
  return {
    lessonId: row.id,
    materialId: row.lesson_materials[0].id,
    lessonNumber: row.lesson_number,
    title: row.title,
    weekNumber: row.week_number,
  };
}

function compareLessonNumbers(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true });
}

function buildTerms(rows: LibraryLessonRow[]): LibraryClubTerm[] {
  const rowsByTerm = new Map<number | null, LibraryLessonRow[]>();

  for (const row of rows) {
    const existing = rowsByTerm.get(row.term_number);
    if (existing) {
      existing.push(row);
    } else {
      rowsByTerm.set(row.term_number, [row]);
    }
  }

  // Numbered terms ascending; null-term coursework ("Other Coursework" at
  // the future UI layer) retained, placed after every numbered term --
  // never dropped, never invented as a fake "Term 1".
  const orderedTermNumbers = [...rowsByTerm.keys()].sort((a, b) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  });

  return orderedTermNumbers.map((termNumber) => {
    const termRows = [...rowsByTerm.get(termNumber)!].sort((a, b) =>
      compareLessonNumbers(a.lesson_number, b.lesson_number),
    );

    const topicOrder: string[] = [];
    const topicsByKey = new Map<string, LibraryClubTopic>();

    for (const row of termRows) {
      const topicKey = row.topic_id ?? "__general__";
      let topic = topicsByKey.get(topicKey);

      if (!topic) {
        topic = {
          topicId: row.topic_id,
          topicTitle: resolveTopicTitle(row.topic) ?? GENERAL_TOPIC_LABEL,
          lessons: [],
        };
        topicsByKey.set(topicKey, topic);
        // Topics appear in order of their earliest lesson: termRows is
        // already lesson_number-ascending, so the first time a topic key
        // is seen here IS its earliest lesson.
        topicOrder.push(topicKey);
      }

      topic.lessons.push(toLibraryClubLesson(row));
    }

    return {
      termNumber,
      topics: topicOrder.map((key) => topicsByKey.get(key)!),
    };
  });
}

async function loadPublishedPdfLessonsForSubject(
  subjectDatabaseId: string,
): Promise<LibraryLessonRow[]> {
  const admin = createSupabaseAdminClient();

  // Single relational query: lessons embeds its subject_topics parent
  // (nullable, same FK name already used by learnerSubjects.ts) and its
  // lesson_materials children (filtered, inner-joined). No lessonIds[]
  // array is ever built and no second .in(...) query is issued -- the
  // "reading"+"pdf" filters apply directly to the embedded
  // lesson_materials rows via PostgREST's dot-notation filter syntax, so
  // a subject with many lessons still produces exactly one bounded
  // request, never a URL whose size grows with the number of lessons.
  const { data, error } = await admin
    .from("lessons")
    .select(
      `
      id,
      lesson_number,
      title,
      term_number,
      week_number,
      topic_id,
      topic:subject_topics!lessons_topic_subject_fkey(id, title),
      lesson_materials!inner(id, material_type, source_type)
      `,
    )
    .eq("subject_id", subjectDatabaseId)
    .eq("status", "published")
    .eq("lesson_materials.material_type", "reading")
    .eq("lesson_materials.source_type", "pdf");

  if (error) throw error;

  const rows = (data ?? []) as unknown as LibraryLessonRow[];

  // Defensive, not load-bearing: the inner-join + embedded filters above
  // already guarantee every returned row carries at least one matching
  // reading/pdf material, and (lesson_id, material_type="reading") is
  // unique per lesson (see lib/lessons/pdfReading.ts's upsert-by-that-key
  // write path), so there is at most one. This guard only protects
  // against ever surfacing a lesson with zero eligible materials if that
  // PostgREST guarantee is ever violated.
  return rows.filter((row) => row.lesson_materials.length > 0);
}

export async function getAuthenticatedLearnerLibraryForSubject(
  requestedSubjectKey: string,
): Promise<LearnerLibraryForSubjectResult> {
  if (!isSubjectKey(requestedSubjectKey)) {
    return { status: "unknown_subject" };
  }

  // The requested subjectKey is a routing value only -- it is resolved to
  // its canonical database subject ID here, but that resolution alone
  // never grants access. Authorization below is checked against the
  // authenticated learner's own approvedSubjects, keyed by this exact
  // databaseId, never by familyKey -- so a learner enrolled in
  // "english-stage-8" cannot reach "english-stage-9" merely because both
  // share familyKey "english".
  const subject = getSubjectConfiguration(requestedSubjectKey);

  const profile = await getAuthenticatedLearnerProfile();
  if (!profile) {
    return { status: "unauthenticated" };
  }

  const access = verifyLearnerSubjectAccessForProfile(
    profile,
    subject.databaseId,
  );

  if (!access.allowed) {
    return access.reason === "invalid-subject"
      ? { status: "unknown_subject" }
      : { status: "not_enrolled" };
  }

  const lessonRows = await loadPublishedPdfLessonsForSubject(
    subject.databaseId,
  );

  return {
    status: "ok",
    library: {
      subject: toLibraryClubSubject(subject),
      terms: buildTerms(lessonRows),
    },
  };
}
