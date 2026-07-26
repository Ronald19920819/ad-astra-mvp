import {
  getAuthenticatedLearnerOnboarding,
} from "@/lib/supabase/learnerOnboarding";
import { createSupabaseRequestClient } from "@/lib/supabase/server";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function onboardingError(
  error: { code?: string; message?: string } | null,
  fallback: string,
) {
  if (error?.code === "42501") {
    return Response.json(
      { error: "Learner sign-in is required.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  console.error("Learner onboarding request failed:", {
    code: error?.code,
    message: error?.message,
  });
  return Response.json(
    { error: fallback, code: "ONBOARDING_FAILED" },
    { status: 500 },
  );
}

export async function GET() {
  try {
    const onboarding = await getAuthenticatedLearnerOnboarding();
    if (!onboarding) {
      return Response.json(
        { error: "Learner sign-in is required.", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    return Response.json({ onboarding });
  } catch (error) {
    return onboardingError(
      error && typeof error === "object"
        ? (error as { code?: string; message?: string })
        : null,
      "Unable to load learner onboarding.",
    );
  }
}

export async function PATCH(request: Request) {
  const body = await readJson(request);
  if (!isRecord(body)) {
    return Response.json(
      { error: "Invalid learner profile.", code: "INVALID_PROFILE" },
      { status: 400 },
    );
  }

  const school = body.school;
  const gradeOrStage = body.gradeOrStage;
  if (
    typeof school !== "string" ||
    school.trim().length < 2 ||
    school.trim().length > 160 ||
    typeof gradeOrStage !== "string" ||
    gradeOrStage.trim().length < 1 ||
    gradeOrStage.trim().length > 100
  ) {
    return Response.json(
      {
        error: "Enter your school and grade or stage.",
        code: "INVALID_PROFILE",
      },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseRequestClient();
  const { error } = await supabase.rpc("complete_own_learner_profile", {
    p_school_name: school.trim(),
    p_grade: gradeOrStage.trim(),
  });
  if (error) {
    return onboardingError(
      error,
      "Unable to save your learner profile. Please try again.",
    );
  }

  return Response.json({ success: true });
}

export async function POST(request: Request) {
  const body = await readJson(request);
  const subjectIds = isRecord(body) ? body.subjectIds : null;

  if (
    !Array.isArray(subjectIds) ||
    subjectIds.length === 0 ||
    subjectIds.length > 4 ||
    !subjectIds.every(
      (subjectId) =>
        typeof subjectId === "string" &&
        Boolean(getSubjectConfigurationByDatabaseId(subjectId)),
    ) ||
    new Set(subjectIds).size !== subjectIds.length
  ) {
    return Response.json(
      {
        error: "Select at least one available subject.",
        code: "INVALID_SUBJECTS",
      },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseRequestClient();
  const { error } = await supabase.rpc("request_own_learner_subjects", {
    p_subject_ids: subjectIds,
  });
  if (error) {
    return onboardingError(
      error,
      "Unable to send your subject requests. Please try again.",
    );
  }

  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  const body = await readJson(request);
  const subjectId = isRecord(body) ? body.subjectId : null;
  if (
    typeof subjectId !== "string" ||
    !getSubjectConfigurationByDatabaseId(subjectId)
  ) {
    return Response.json(
      { error: "Select a valid subject.", code: "INVALID_SUBJECT" },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseRequestClient();
  const { data: removed, error } = await supabase.rpc(
    "deregister_own_learner_subject",
    { p_subject_id: subjectId },
  );
  if (error) {
    return onboardingError(
      error,
      "Unable to deregister this subject. Please try again.",
    );
  }
  if (!removed) {
    return Response.json(
      { error: "This subject is not currently active.", code: "NOT_ACTIVE" },
      { status: 409 },
    );
  }

  return Response.json({ success: true });
}
