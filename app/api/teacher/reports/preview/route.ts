import { NextResponse } from "next/server";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import { resolveLearnerAuthUserId } from "@/lib/reports/monthlyReportCatalog";
import { generateMonthlyReportPreview } from "@/lib/reports/monthlyReportEngine";
import { normalizeReportMonth } from "@/lib/reports/monthlyReportMonth";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((id) => typeof id === "string" && uuidPattern.test(id));
}

// AD ASTRA MONTHLY LEARNER REPORT -- STAGE 2: the ONE route that calls the
// deterministic engine. Used twice by the UI with the exact same
// contract: once with the full catalog's lesson/activity IDs (Step 3's
// "browse everything and show status" view) and once with the teacher's
// actual final selection (the real preview). No calculation happens here
// or in any React component -- this route only validates input, resolves
// identities, and calls generateMonthlyReportPreview.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON request body.", code: "MALFORMED_JSON" },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Invalid preview request.", code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  const payload = body as Record<string, unknown>;
  const { subjectId, learnerProfileId, reportMonth, selectedLessonIds, selectedActivityIds } = payload;

  if (
    typeof subjectId !== "string" ||
    !uuidPattern.test(subjectId) ||
    typeof learnerProfileId !== "string" ||
    !uuidPattern.test(learnerProfileId) ||
    typeof reportMonth !== "string" ||
    !isUuidArray(selectedLessonIds) ||
    !isUuidArray(selectedActivityIds)
  ) {
    return NextResponse.json(
      { error: "Invalid preview request.", code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  let normalizedReportMonth: string;
  try {
    normalizedReportMonth = normalizeReportMonth(reportMonth);
  } catch {
    return NextResponse.json(
      { error: "Invalid reporting month.", code: "INVALID_REPORT_MONTH" },
      { status: 400 },
    );
  }

  const authorization = await authorizeTeacher(subjectId);
  if (!authorization.success) {
    return teacherAuthorizationResponse(authorization);
  }

  try {
    const learnerAuthUserId = await resolveLearnerAuthUserId(learnerProfileId);
    if (!learnerAuthUserId) {
      return NextResponse.json(
        { error: "Learner not found for this subject.", code: "LEARNER_NOT_FOUND" },
        { status: 404 },
      );
    }

    const report = await generateMonthlyReportPreview({
      learnerId: learnerAuthUserId,
      subjectId,
      teacherId: authorization.teacher.profileId,
      reportMonth: normalizedReportMonth,
      selectedLessonIds,
      selectedActivityIds,
    });

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Unable to generate the report preview:", error);
    return NextResponse.json(
      { error: "Unable to generate the report preview.", code: "PREVIEW_FAILED" },
      { status: 500 },
    );
  }
}
