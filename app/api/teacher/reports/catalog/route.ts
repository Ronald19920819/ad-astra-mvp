import { NextResponse } from "next/server";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import { getSubjectReportableCatalog } from "@/lib/reports/monthlyReportCatalog";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// AD ASTRA MONTHLY LEARNER REPORT -- STAGE 2, Step 3 (select content).
// Returns the FULL universe of selectable lesson/activity IDs for a
// subject -- every published lesson, every proper graded activity, never
// filtered by any learner's completion/submission state. Outstanding work
// must remain selectable (locked requirement); this endpoint never even
// looks at a learner, so it cannot accidentally exclude anything based on
// status.
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
    const catalog = await getSubjectReportableCatalog(subjectId);
    return NextResponse.json(catalog);
  } catch (error) {
    console.error("Unable to load the report content catalog:", error);
    return NextResponse.json(
      { error: "Unable to load selectable lessons and activities.", code: "CATALOG_LOAD_FAILED" },
      { status: 500 },
    );
  }
}
