import { getAuthenticatedTeacherProfile } from "@/lib/supabase/teacherProfile";

export async function GET() {
  try {
    const profile = await getAuthenticatedTeacherProfile();
    if (!profile) {
      return Response.json(
        { error: "Teacher profile unavailable." },
        { status: 401 },
      );
    }

    return Response.json({ profile });
  } catch (error) {
    console.error("Unable to load authenticated teacher profile:", error);
    return Response.json(
      { error: "Unable to load your teacher profile." },
      { status: 500 },
    );
  }
}
