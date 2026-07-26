"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setMessage("The passwords do not match.");
      return;
    }

    try {
      setIsSaving(true);
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setMessage("Unable to update your password. Request a new reset link.");
        return;
      }

      router.replace("/login?password=updated");
      router.refresh();
    } catch (error) {
      console.error("Unable to update password:", error);
      setMessage("Unable to update your password. Request a new reset link.");
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

        <form onSubmit={updatePassword} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-slate-800">
            New password
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-blue-100 px-4 py-3 outline-none focus:border-[#508DB1]"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-800">
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-blue-100 px-4 py-3 outline-none focus:border-[#508DB1]"
            />
          </label>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-2xl bg-[#102A43] py-3 font-semibold text-white disabled:opacity-60"
          >
            {isSaving ? "Updating password..." : "Update Password"}
          </button>

          {message && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {message}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
