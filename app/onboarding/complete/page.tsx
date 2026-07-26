import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedLearnerOnboarding } from "@/lib/supabase/learnerOnboarding";

export const dynamic = "force-dynamic";

export default async function LearnerOnboardingCompletePage() {
  const onboarding = await getAuthenticatedLearnerOnboarding();
  if (!onboarding) redirect("/login");

  const pendingSubjects = onboarding.subjects.filter(
    (subject) => subject.status === "pending",
  );

  return (
    <main className="flex min-h-screen items-center bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] px-4 py-8">
      <section className="mx-auto w-full max-w-md rounded-[2rem] border border-blue-100 bg-white p-7 text-center shadow-sm">
        <h1 className="text-3xl font-bold text-[#102A43]">
          Your registration is complete.
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Your subject requests have been sent to your teacher.
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-700">
          You will gain access after approval.
        </p>

        {pendingSubjects.length > 0 && (
          <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-left">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
              Pending Requests
            </p>
            <ul className="mt-2 space-y-1 text-sm font-semibold text-slate-700">
              {pendingSubjects.map((subject) => (
                <li key={subject.id}>{subject.name}</li>
              ))}
            </ul>
          </div>
        )}

        <Link
          href="/home"
          className="mt-6 block rounded-2xl bg-[#102A43] px-4 py-3 font-bold text-white"
        >
          Continue to Home
        </Link>
      </section>
    </main>
  );
}
