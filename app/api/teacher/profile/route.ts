import { getAuthenticatedTeacherProfileDashboard } from "@/lib/supabase/teacherProfile";

export async function GET() {
  try {
    const dashboard = await getAuthenticatedTeacherProfileDashboard();
    if (!dashboard) {
      return Response.json(
        { error: "Teacher profile unavailable." },
        { status: 401 },
      );
    }
    return Response.json(dashboard);
  } catch (error) {
    console.error("Unable to load authenticated teacher profile:", error);
    return Response.json(
      { error: "Unable to load your teacher profile." },
      { status: 500 },
    );
  }
}
