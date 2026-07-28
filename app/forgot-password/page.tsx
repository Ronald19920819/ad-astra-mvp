"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSending) return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setErrorMessage("Enter the email address used for your AD Astra account.");
      return;
    }

    try {
      setIsSending(true);
      setErrorMessage("");
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        },
      );

      if (error) {
        console.error("Unable to request password recovery:", error.message);
        setErrorMessage("Unable to send the reset email. Please try again.");
        return;
      }

      setIsSent(true);
    } catch (error) {
      console.error("Password recovery request failed:", error);
      setErrorMessage("Unable to send the reset email. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-b from-[#EAF5FF] via-[#F6FAFC] to-[#FFF8E8] px-4 py-8 font-sans sm:px-6 sm:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <section className="w-full min-w-0 rounded-[2.25rem] border border-blue-100/90 bg-white px-6 py-8 shadow-[0_24px_70px_rgba(16,42,67,0.14)] sm:px-9 sm:py-10">
          <div className="text-center">
            <Image
              src="/ad_astra_logo.png"
              alt="AD Astra logo"
              width={92}
              height={92}
              priority
              className="mx-auto h-auto w-[92px]"
            />
            <h1 className="mt-5 text-2xl font-bold text-[#102A43]">
              Reset your password
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Enter your account email and we&apos;ll send you a secure reset
              link.
            </p>
          </div>

          {isSent ? (
            <div className="mt-7">
              <p
                role="status"
                className="rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold leading-5 text-green-700"
              >
                Check your email for a password reset link.
              </p>
              <Link
                href="/login"
                className="mt-4 block w-full rounded-2xl bg-[#102A43] px-4 py-3.5 text-center text-sm font-bold text-white"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={requestReset} className="mt-7 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#102A43]">
                  Email address
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-[#508DB1] focus:ring-2 focus:ring-blue-100"
                />
              </label>

              {errorMessage && (
                <p
                  role="alert"
                  className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold leading-5 text-red-700"
                >
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isSending}
                className="w-full rounded-2xl bg-[#102A43] px-4 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#173D5E] disabled:cursor-wait disabled:opacity-60"
              >
                {isSending ? "Sending reset email..." : "Send Reset Link"}
              </button>
              <Link
                href="/login"
                className="block text-center text-sm font-semibold text-[#508DB1]"
              >
                Back to Sign In
              </Link>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
