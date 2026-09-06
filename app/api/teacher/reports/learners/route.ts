import { NextResponse } from "next/server";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import { getSubjectEnrolledLearnersForReports } from "@/lib/reports/monthlyReportCatalog";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// AD ASTRA MONTHLY LEARNER REPORT -- STAGE 2, Step 2 (select learner).
// Returns only learners genuinely enrolled in the requested subject --
// authorizeTeacher(subjectId) already refuses any teacher not assigned to
// that subject, so there is no separate "unrelated learner" check needed
// beyond the subject-scoped query itself.
export async function GET(request: Request) {
  const subjectId = new URL(request.url).searchParams.get("subjectId");

  if (!subjectId || !uuidPattern.test(subjectId)) {
    return NextResponse.json(
      { error: "A valid subjectId is required.", code: "INVALID_SUBJECT" },
      { status: 400 },
    );
  }

  const authorization = await authorizeTeacher(subjectId);
  if (!authorization.success) {
    return teacherAuthorizationResponse(authorization);
  }

  try {
    const learners = await getSubjectEnrolledLearnersForReports(subjectId);
    return NextResponse.json({ learners });
  } catch (error) {
    console.error("Unable to load learners for the report generator:", error);
    return NextResponse.json(
      { error: "Unable to load learners.", code: "LEARNERS_LOAD_FAILED" },
      { status: 500 },
    );
  }
}
