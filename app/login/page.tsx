"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Oxanium } from "next/font/google";
import { createClient } from "@/lib/supabase/client";

const oxanium = Oxanium({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

type VerificationResponse = {
  success?: boolean;
  code?: string;
  actualRole?: "learner" | "teacher";
  destination?: string;
};

const definitiveAuthorizationFailures = new Set([
  "PROFILE_NOT_FOUND",
  "INACTIVE_TEACHER",
  "INACTIVE_LEARNER",
  "INVALID_ROLE",
]);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function signIn() {
    if (isSigningIn) return;

    if (!email.trim() || !password) {
      setErrorMessage("Enter your email address and password.");
      return;
    }

    setIsSigningIn(true);
    setErrorMessage("");
    const supabase = createClient();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user || !data.session) {
        setErrorMessage("The email address or password is incorrect.");
        return;
      }

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = (await response.json().catch(() => null)) as
        | VerificationResponse
        | null;

      if (!response.ok || !result?.success || !result.destination) {
        if (
          result?.code &&
          definitiveAuthorizationFailures.has(result.code)
        ) {
          await supabase.auth.signOut();
        }

        if (result?.code === "PROFILE_NOT_FOUND") {
          setErrorMessage(
            "This account is not connected to an AD Astra profile.",
          );
        } else if (result?.code === "INACTIVE_TEACHER") {
          setErrorMessage("This teacher account is not active.");
        } else if (result?.code === "INACTIVE_LEARNER") {
          setErrorMessage("This learner account is not active.");
        } else if (result?.code === "INVALID_ROLE") {
          setErrorMessage("This account does not have an authorised AD Astra role.");
        } else {
          setErrorMessage("Sign in could not be completed. Please try again.");
        }
        return;
      }

      router.replace(result.destination);
      router.refresh();
    } catch (error) {
      console.error("AD Astra sign-in failed:", error);
      setErrorMessage("Sign in could not be completed. Please try again.");
    } finally {
      setIsSigningIn(false);
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
            <Image
              src="/ad_astra_wordmark.png"
              alt="AD Astra"
              width={250}
              height={63}
              priority
              className="mx-auto mt-3 h-auto w-full max-w-[250px]"
            />
            <p className="mt-4 text-sm font-medium text-slate-500">
              Sign in to continue to AD Astra
            </p>
          </div>

          <form
            className="mt-8 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void signIn();
            }}
          >
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

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#102A43]">
                Password
              </span>
              <div className="relative min-w-0">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full min-w-0 rounded-2xl border border-slate-300 bg-white py-3.5 pl-4 pr-16 text-sm text-slate-900 outline-none transition focus:border-[#508DB1] focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex min-w-14 items-center justify-center px-3 text-xs font-bold text-[#508DB1]"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <label className="flex items-center gap-2 font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 accent-[#102A43]"
                />
                Remember me
              </label>
              <Link
                href="/forgot-password"
                className="font-semibold text-[#508DB1]"
              >
                Forgot password?
              </Link>
            </div>

            {errorMessage && (
              <p
                role="alert"
                className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold leading-5 text-red-700"
              >
                {errorMessage}
              </p>
            )}

            <div className="pt-1">
              <button
                type="submit"
                disabled={isSigningIn}
                className="w-full rounded-2xl bg-[#102A43] px-4 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#173D5E] disabled:cursor-wait disabled:opacity-60"
              >
                {isSigningIn ? "Signing in..." : "Sign In"}
              </button>
              <Link
                href="/register"
                className="mt-3 block w-full rounded-2xl border border-blue-200 bg-[#F8FBFF] px-4 py-3.5 text-center text-sm font-bold text-[#102A43]"
              >
                Create Learner Account
              </Link>
            </div>
          </form>

          <p
            className={`${oxanium.className} mt-8 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400`}
          >
            AD Astra Learning System
          </p>
        </section>
      </div>
    </main>
  );
}
