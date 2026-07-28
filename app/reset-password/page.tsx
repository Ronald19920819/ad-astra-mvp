"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isRecoveryReady, setIsRecoveryReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccessful, setIsSuccessful] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function establishRecoverySession() {
      const supabase = createClient();
      const code = new URLSearchParams(window.location.search).get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (isActive) {
            setErrorMessage(
              "This reset link is invalid or has expired. Request a new one.",
            );
          }
          return;
        }

        window.history.replaceState({}, "", "/reset-password");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isActive) return;
      if (!session) {
        setErrorMessage(
          "This reset link is invalid or has expired. Request a new one.",
        );
        return;
      }

      setIsRecoveryReady(true);
    }

    void establishRecoverySession();
    return () => {
      isActive = false;
    };
  }, []);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (password.length < 8) {
      setErrorMessage("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setErrorMessage("The passwords do not match.");
      return;
    }

    try {
      setIsSaving(true);
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrorMessage(
          "Unable to update your password. Request a new reset link.",
        );
        return;
      }

      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error(
          "Password updated, but recovery session sign-out failed:",
          signOutError.message,
        );
      }

      setIsSuccessful(true);
      window.setTimeout(() => {
        router.replace("/login?password=updated");
        router.refresh();
      }, 1500);
    } catch (error) {
      console.error("Unable to update password:", error);
      setErrorMessage(
        "Unable to update your password. Request a new reset link.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EAF5FF] to-[#FFF8E8] px-4 py-10">
      <div className="mx-auto max-w-md rounded-[2rem] border border-blue-100 bg-white p-6 shadow-lg">
        <div className="mb-6 flex justify-center">
          <Image
            src="/ad_astra_wordmark.png"
            alt="AD Astra"
            width={220}
            height={50}
            className="h-auto w-auto"
          />
        </div>

        <h1 className="text-2xl font-bold text-[#102A43]">
          Choose a new password
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter and confirm your new AD Astra password.
        </p>

        {isSuccessful ? (
          <p
            role="status"
            className="mt-6 rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700"
          >
            Your password has been updated. Returning you to Sign In...
          </p>
        ) : (
          <form onSubmit={updatePassword} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-slate-800">
              New password
              <div className="relative mt-2 min-w-0">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={!isRecoveryReady}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full min-w-0 rounded-2xl border border-blue-100 py-3 pl-4 pr-16 outline-none focus:border-[#508DB1] disabled:bg-slate-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide new password" : "Show new password"}
                  className="absolute inset-y-0 right-0 min-w-14 px-3 text-xs font-bold text-[#508DB1]"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <label className="block text-sm font-semibold text-slate-800">
              Confirm new password
              <div className="relative mt-2 min-w-0">
                <input
                  type={showConfirmation ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={!isRecoveryReady}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="w-full min-w-0 rounded-2xl border border-blue-100 py-3 pl-4 pr-16 outline-none focus:border-[#508DB1] disabled:bg-slate-50"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmation((visible) => !visible)
                  }
                  aria-label={
                    showConfirmation
                      ? "Hide confirmed password"
                      : "Show confirmed password"
                  }
                  className="absolute inset-y-0 right-0 min-w-14 px-3 text-xs font-bold text-[#508DB1]"
                >
                  {showConfirmation ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={isSaving || !isRecoveryReady}
              className="w-full rounded-2xl bg-[#102A43] py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60"
            >
              {isSaving
                ? "Updating password..."
                : isRecoveryReady
                  ? "Update Password"
                  : "Checking reset link..."}
            </button>

            {errorMessage && (
              <p
                role="alert"
                className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {errorMessage}
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
