import { NextResponse } from "next/server";
import {
  authorizeTeacher,
  teacherAuthorizationResponse,
} from "@/lib/supabase/teacherAuth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  listFinalisedMonthlyReportArchive,
  listFinalisedMonthlyReportYears,
} from "@/lib/reports/monthlyReportArchiveRepository";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMissingColumnError(error: { code?: string } | null) {
  return error?.code === "42703" || error?.code === "PGRST204";
}

// AD ASTRA MONTHLY REPORT -- STAGE 4D: TEACHER FINALISED REPORT ARCHIVE.
// The archive spans every subject the teacher is authorised for, never
// just one -- so this route resolves that authorised subject set itself
// (mirroring authorizeTeacher's own teacher_subjects join) rather than
// calling authorizeTeacher(subjectId) for a single subject. A subjectId
// query param, if present, only ever narrows within that authorised set
// -- see listFinalisedMonthlyReportArchive's own defense-in-depth filter.
async function resolveAssignedSubjectIds(teacherProfileId: string): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  let { data, error } = await admin
    .from("teacher_subjects")
    .select("subject_id")
    .eq("teacher_profile_id", teacherProfileId)
    .eq("status", "active");

  if (isMissingColumnError(error)) {
    const fallback = await admin
      .from("teacher_subjects")
      .select("subject_id")
      .eq("teacher_profile_id", teacherProfileId);
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;
  return (data ?? []).map((row) => row.subject_id as string);
}

export async function GET(request: Request) {
  const authorization = await authorizeTeacher();
  if (!authorization.success) {
    return teacherAuthorizationResponse(authorization);
  }

  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");
  const monthParam = url.searchParams.get("month");
  const subjectIdParam = url.searchParams.get("subjectId");
  const searchParam = url.searchParams.get("search");

  if (subjectIdParam && !uuidPattern.test(subjectIdParam)) {
    return NextResponse.json(
      { error: "Invalid subjectId.", code: "INVALID_SUBJECT" },
      { status: 400 },
    );
  }

  const year = yearParam ? Number(yearParam) : undefined;
  if (year !== undefined && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
    return NextResponse.json(
      { error: "Invalid year.", code: "INVALID_YEAR" },
      { status: 400 },
    );
  }

  const month = monthParam ? Number(monthParam) : undefined;
  if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) {
    return NextResponse.json(
      { error: "Invalid month.", code: "INVALID_MONTH" },
      { status: 400 },
    );
  }

  try {
    const subjectIds = await resolveAssignedSubjectIds(authorization.teacher.teacherProfileId);

    const [years, entries] = await Promise.all([
      listFinalisedMonthlyReportYears(subjectIds),
      listFinalisedMonthlyReportArchive({
        subjectIds,
        year,
        month,
        subjectId: subjectIdParam ?? undefined,
        search: searchParam ?? undefined,
      }),
    ]);

    return NextResponse.json({ years, entries });
  } catch (error) {
    console.error("Unable to load the finalised report archive:", error);
    return NextResponse.json(
      { error: "Unable to load the report archive.", code: "ARCHIVE_LOAD_FAILED" },
      { status: 500 },
    );
  }
}
