import "server-only";

import { getAuthenticatedLearnerProfile } from "@/lib/supabase/learnerProfile";
import { verifyLearnerSubjectAccessForProfile } from "@/lib/supabase/subjectAccess";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  isEligibleLibraryReadingMaterial,
  isPublishedLessonForSubject,
} from "@/lib/lessons/pdfReading";
import {
  getSubjectConfiguration,
  isSubjectKey,
  type SubjectConfiguration,
} from "@/lib/subjects/subjectConfig";

// AD ASTRA -- LIBRARY CLUB (STAGE C): the ONE shared authorization +
// canonical-material-resolution helper used by both the Library Club
// viewing page and the Library Club download route, so this security
// logic exists in exactly one place. It deliberately re-derives
// everything from the database on every call -- it never trusts a
// subjectKey/lessonId pairing merely because the caller supplied it, and
// it is never fed a cached catalogue result. It does NOT generate a
// signed URL itself (View reuses the existing, unmodified
// /api/lessons/[lessonId]/reading-pdf route for that; Download generates
// its own signed URL with a download disposition) -- its only job is to
// answer "is this exact (subjectKey, lessonId) pair currently a
// published, PDF-backed Library Club reading this learner may access?".
//
// "unknown_subject" / "not_enrolled" / "lesson not found" / "lesson
// belongs to a different subject" / "lesson not published" / "no reading
// material" / "reading is not a PDF" / "stored path does not match the
// expected canonical convention" are ALL collapsed into the single
// "not_found" status. This is deliberate, not an oversight: a caller
// (the page, or the download route) that observed a different response
// for each of those cases would let a learner distinguish "this subject
// doesn't exist" from "I'm just not enrolled in it" from "that lesson
// belongs to someone else's subject" -- exactly the internal-detail leak
// this stage's security rules forbid. The one case kept distinct is
// "unauthenticated", since that already has its own standard, equally
// non-revealing handling (a sign-in prompt) throughout this codebase.

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AuthorizedLibraryReading = {
  subject: SubjectConfiguration;
  lessonId: string;
  lessonNumber: string;
  lessonTitle: string;
  materialId: string;
  // Server-side only: the canonical Storage path. Never returned to the
  // browser by either caller -- the page only reads materialId (a
  // database row id, safe to pass to the existing client PDF viewer),
  // and the download route consumes this value itself, inside the same
  // request, to generate a short-lived signed URL -- it is never
  // serialized into any JSON/HTML response.
  contentPath: string;
};

export type LibraryPdfAccessResult =
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "ok"; reading: AuthorizedLibraryReading };

type LessonRow = {
  id: string;
  subject_id: string;
  status: string;
  lesson_number: string;
  title: string;
};

type MaterialRow = {
  id: string;
  lesson_id: string;
  material_type: string;
  source_type: string;
  content_url: string | null;
};

export async function resolveAuthorizedLibraryReading(
  requestedSubjectKey: string,
  requestedLessonId: string,
): Promise<LibraryPdfAccessResult> {
  if (!isSubjectKey(requestedSubjectKey) || !uuidPattern.test(requestedLessonId)) {
    return { status: "not_found" };
  }

  // The requested subjectKey is a routing value only -- resolving it to
  // its canonical databaseId never itself grants access (checked next).
  const subject = getSubjectConfiguration(requestedSubjectKey);

  const profile = await getAuthenticatedLearnerProfile();
  if (!profile) {
    return { status: "unauthenticated" };
  }

  const access = verifyLearnerSubjectAccessForProfile(profile, subject.databaseId);
  if (!access.allowed) {
    return { status: "not_found" };
  }

  const admin = createSupabaseAdminClient();

  const { data: lessonData, error: lessonError } = await admin
    .from("lessons")
    .select("id, subject_id, status, lesson_number, title")
    .eq("id", requestedLessonId)
    .maybeSingle();

  if (lessonError) throw lessonError;

  const lesson = lessonData as LessonRow | null;

  // isPublishedLessonForSubject (lib/lessons/pdfReading.ts) checks, all
  // independently: the lesson must exist, must be published (draft
  // lessons are never Library-eligible), and must belong to the EXACT
  // requested subject's databaseId -- not merely some subject this
  // learner happens to have access to.
  if (!lesson || !isPublishedLessonForSubject(lesson, subject.databaseId)) {
    return { status: "not_found" };
  }

  const { data: materialData, error: materialError } = await admin
    .from("lesson_materials")
    .select("id, lesson_id, material_type, source_type, content_url")
    .eq("lesson_id", requestedLessonId)
    .eq("material_type", "reading")
    .maybeSingle();

  if (materialError) throw materialError;

  const material = materialData as MaterialRow | null;

  // isEligibleLibraryReadingMaterial (lib/lessons/pdfReading.ts) checks,
  // all independently: the material must exist, must belong to this
  // exact lesson, must be a "reading" material, must be "pdf" sourced
  // (never pasted_text/Kingdom-generated text), and its stored path must
  // match the expected canonical {subjectId}/{lessonId}/{uuid}.pdf
  // convention -- never an arbitrary client-supplied path.
  if (
    !material ||
    typeof material.content_url !== "string" ||
    !isEligibleLibraryReadingMaterial(material, requestedLessonId, subject.databaseId)
  ) {
    return { status: "not_found" };
  }

  return {
    status: "ok",
    reading: {
      subject,
      lessonId: lesson.id,
      lessonNumber: lesson.lesson_number,
      lessonTitle: lesson.title,
      materialId: material.id,
      contentPath: material.content_url,
    },
  };
}
