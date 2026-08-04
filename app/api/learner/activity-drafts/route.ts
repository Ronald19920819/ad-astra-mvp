import { NextResponse } from "next/server";
import {
  deleteLearnerActivityDraft,
  getAuthenticatedLearnerDraftIdentity,
  loadLearnerActivityDraft,
  saveLearnerActivityDraft,
  type ActivityDraftAnswerInput,
} from "@/lib/supabase/activityDrafts";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isDraftAnswer(value: unknown): value is ActivityDraftAnswerInput {
  if (!value || typeof value !== "object") return false;

  const answer = value as Record<string, unknown>;
  return (
    typeof answer.questionId === "string" &&
    uuidPattern.test(answer.questionId) &&
    typeof answer.answerText === "string" &&
    answer.answerText.length <= 10000
  );
}

export async function GET(request: Request) {
  const activityId = new URL(request.url).searchParams.get("activityId");

  if (!activityId || !uuidPattern.test(activityId)) {
    return NextResponse.json(
      { error: "Invalid activity ID", code: "INVALID_ACTIVITY" },
      { status: 400 },
    );
  }

  try {
    const result = await loadLearnerActivityDraft(activityId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status },
      );
    }

    return NextResponse.json({
      learnerId: result.learnerId,
      subjectId: result.subjectId,
      currentActivityVersion: result.currentActivityVersion,
      draft: result.draft,
    });
  } catch (error) {
    console.error("Unable to load learner activity draft:", error);
    return NextResponse.json(
      { error: "Unable to load activity draft", code: "LOAD_FAILED" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const activityId = body.activityId;
    const activityVersion = body.activityVersion;
    const expectedRevision = body.revision;
    const answers = body.answers;

    if (
      typeof activityId !== "string" ||
      !uuidPattern.test(activityId) ||
      !Number.isInteger(activityVersion) ||
      !Number.isInteger(expectedRevision) ||
      !Array.isArray(answers) ||
      !answers.every(isDraftAnswer)
    ) {
      return NextResponse.json(
        { error: "Invalid draft data", code: "INVALID_DRAFT" },
        { status: 400 },
      );
    }

    const result = await saveLearnerActivityDraft({
      activityId,
      activityVersion: Number(activityVersion),
      expectedRevision: Number(expectedRevision),
      answers,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status },
      );
    }

    return NextResponse.json({
      learnerId: result.learnerId,
      draft: result.draft,
    });
  } catch (error) {
    console.error("Unable to save learner activity draft:", {
      name: error instanceof Error ? error.name : null,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      status: 500,
      route: "/api/learner/activity-drafts",
      method: "PUT",
    });
    return NextResponse.json(
      { error: "Unable to save activity draft", code: "SAVE_FAILED" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const activityId = new URL(request.url).searchParams.get("activityId");

  if (!activityId || !uuidPattern.test(activityId)) {
    return NextResponse.json(
      { error: "Invalid activity ID", code: "INVALID_ACTIVITY" },
      { status: 400 },
    );
  }

  try {
    const identity = await getAuthenticatedLearnerDraftIdentity();
    if (!("learnerId" in identity)) {
      return NextResponse.json(
        { error: identity.error, code: identity.code },
        { status: identity.status },
      );
    }

    await deleteLearnerActivityDraft(activityId, identity.learnerId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to delete learner activity draft:", error);
    return NextResponse.json(
      { error: "Unable to delete activity draft", code: "DELETE_FAILED" },
      { status: 500 },
    );
  }
}
