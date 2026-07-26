"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { learnerRegistrationError } from "@/lib/learners/onboarding";

export default function LearnerRegistrationPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function registerLearner(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const cleanFirstName = firstName.trim();
    const cleanSurname = surname.trim();
    const cleanEmail = email.trim().toLowerCase();

    const validationError = learnerRegistrationError({
      firstName: cleanFirstName,
      surname: cleanSurname,
      email: cleanEmail,
      password,
      confirmPassword,
    });
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            first_name: cleanFirstName,
            surname: cleanSurname,
            full_name: `${cleanFirstName} ${cleanSurname}`,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding/profile`,
        },
      });

      if (error) {
        setErrorMessage(
          error.message.toLowerCase().includes("already")
            ? "An account already exists for this email address."
            : "Unable to create your learner account. Please try again.",
        );
        return;
      }

      if (data.session) {
        router.replace("/onboarding/profile");
        router.refresh();
      } else {
        router.replace("/register/check-email");
      }
    } catch (error) {
      console.error("Learner registration failed:", error);
      setErrorMessage(
        "Unable to create your learner account. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EAF5FF] via-[#F6FAFC] to-[#FFF8E8] px-4 py-8 sm:px-6">
      <section className="mx-auto w-full max-w-md rounded-[2.25rem] border border-blue-100 bg-white px-6 py-8 shadow-[0_24px_70px_rgba(16,42,67,0.14)] sm:px-9">
        <Image
          src="/ad_astra_logo.png"
          alt="AD Astra"
          width={82}
          height={82}
          priority
          className="mx-auto"
        />
        <h1 className="mt-4 text-center text-3xl font-bold text-[#102A43]">
          Create Learner Account
        </h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Register to request access to your AD Astra subjects.
        </p>

        <form className="mt-7 space-y-4" onSubmit={registerLearner}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#102A43]">
                First Name
              </span>
              <input
                required
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#508DB1]"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#102A43]">
                Surname
              </span>
              <input
                required
                autoComplete="family-name"
                value={surname}
                onChange={(event) => setSurname(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#508DB1]"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#102A43]">
              Email Address
            </span>
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#508DB1]"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#102A43]">
              Password
            </span>
            <div className="relative">
              <input
                required
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 py-3 pl-4 pr-16 text-sm outline-none focus:border-[#508DB1]"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                onClick={() => setShowPassword((current) => !current)}
                className="absolute inset-y-0 right-0 px-4 text-xs font-bold text-[#508DB1]"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#102A43]">
              Confirm Password
            </span>
            <input
              required
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#508DB1]"
            />
          </label>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
            >
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-[#102A43] px-4 py-3.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {isSubmitting ? "Creating account..." : "Create Learner Account"}
          </button>
        </form>

        <Link
          href="/login"
          className="mt-4 block text-center text-sm font-semibold text-[#508DB1]"
        >
          Return to Sign In
        </Link>
      </section>
    </main>
  );
}
