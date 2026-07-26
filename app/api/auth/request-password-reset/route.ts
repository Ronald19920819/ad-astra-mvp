import { getAuthenticatedPasswordResetEmail } from "@/lib/auth/passwordReset";
import { createSupabaseRequestClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseRequestClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    const email = user
      ? getAuthenticatedPasswordResetEmail({
          email: user.email,
          emailConfirmedAt: user.email_confirmed_at,
        })
      : null;

    if (userError || !user || !email) {
      return Response.json(
        { error: "An authenticated account with a verified email is required." },
        { status: 401 },
      );
    }

    const redirectTo = new URL(
      "/auth/callback?next=/reset-password",
      request.url,
    ).toString();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error("Unable to request password reset:", {
        userId: user.id,
        message: error.message,
      });
      return Response.json(
        { error: "Unable to send the password reset email. Please try again." },
        { status: 500 },
      );
    }

    return Response.json({
      message: "Check your email for a secure password reset link.",
    });
  } catch (error) {
    console.error("Password reset request failed:", error);
    return Response.json(
      { error: "Unable to send the password reset email. Please try again." },
      { status: 500 },
    );
  }
}
