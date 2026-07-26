import { createSupabaseRequestClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseRequestClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("AD Astra sign-out failed:", { message: error.message });
    return Response.json(
      { error: "Unable to sign out. Please try again." },
      { status: 500 },
    );
  }

  return Response.json({ success: true });
}
