import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ChevronRight, FileText, Folder, ScanLine } from "lucide-react";
import { neueHaas } from "@/app/fonts";
import { getAuthenticatedTeacherProfile } from "@/lib/supabase/teacherProfile";

// AD ASTRA EXAMINATION CENTRE -- STAGE 2 (landing page only). Mirrors
// app/store/page.tsx's own hero/auth conventions exactly: a single hero
// card (illustration as the background, heading/tagline overlaid, never
// two separate cards), and getAuthenticatedTeacherProfile() resolves the
// real teacher (never a client-supplied id). An unsuccessful resolution
// degrades to the same graceful inline message convention used
// throughout this app -- no redirect, no private data ever rendered.
//
// Deliberately does NOT require assigned subjects/learners/lessons/
// activities -- getAuthenticatedTeacherProfile() alone (not
// getAuthenticatedTeacherProfileDashboard(), which also computes a
// teaching overview this page has no use for) is enough to prove "this
// is a genuine, signed-in teacher," which is the only access rule the
// Examination Centre has in this stage.
export const dynamic = "force-dynamic";

export default async function ExaminationCentrePage() {
  const teacherProfile = await getAuthenticatedTeacherProfile();

  if (!teacherProfile) {
    return (
      <main className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6`}>
        <div className="mx-auto max-w-md rounded-[2rem] border border-blue-100 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-600">Teacher sign-in is required.</p>
          <Link href="/teacher" prefetch={false} className="mt-4 inline-block text-sm font-semibold text-[#508DB1]">
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-4 pb-16 sm:px-6 sm:pt-6 lg:px-8`}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 lg:max-w-6xl">
        <Link
          href="/teacher"
          prefetch={false}
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#508DB1]"
        >
          <ArrowLeft size={17} /> Back to Dashboard
        </Link>

        {/* A. Premium Examination Centre hero -- a single card, mirroring
            the Store hero exactly: the supplied illustration as the
            background, heading/tagline overlaid top-left on a dark
            gradient for readability. Never two separate cards. */}
        <section className="relative h-48 overflow-hidden rounded-[2rem] border border-blue-100 shadow-lg sm:h-64 lg:h-80">
          <Image
            src="/images/examination-centre-header.png"
            alt="AD Astra Examination Centre -- an illustrated academic scene in navy and warm gold"
            fill
            sizes="(min-width: 1024px) 1152px, 100vw"
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#102A43]/90 via-[#102A43]/40 to-transparent" />
          <div className="absolute inset-0 flex flex-col items-start justify-start p-6 text-white lg:p-10">
            <h1 className="text-3xl font-extrabold lg:text-4xl">AD Astra Examination Centre</h1>
            <p className="mt-2 text-sm font-semibold text-blue-100 lg:text-base">
              Create. Assess. Inspire.
            </p>
          </div>
        </section>

        {/* B. Primary action cards -- equally prominent, side by side on
            desktop, stacked on mobile. Both are plain divs, not Links --
            the destination workflows (Kingdom examination creation,
            marking) do not exist yet, so neither must navigate anywhere
            or appear as a working link. The arrow is purely a visual
            affordance signalling future navigation. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex items-center gap-4 rounded-[2rem] border border-[#D9A106]/30 bg-[#FFF8E6] p-5 shadow-sm transition hover:shadow-md focus-within:shadow-md">
            <div className="flex-shrink-0 rounded-2xl bg-white p-3 text-[#D9A106]">
              <FileText size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-[#102A43]">Create Examination</h2>
              <p className="mt-1 text-xs font-medium text-black/50">
                Design professional examination papers with Kingdom.
              </p>
            </div>
            <ChevronRight size={20} className="flex-shrink-0 text-[#D9A106]" />
          </div>

          <div className="flex items-center gap-4 rounded-[2rem] border border-[#D9A106]/30 bg-[#FFF8E6] p-5 shadow-sm transition hover:shadow-md focus-within:shadow-md">
            <div className="flex-shrink-0 rounded-2xl bg-white p-3 text-[#D9A106]">
              <ScanLine size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-[#102A43]">Mark Examination</h2>
              <p className="mt-1 text-xs font-medium text-black/50">
                Scan learner scripts and review Kingdom&apos;s marking.
              </p>
            </div>
            <ChevronRight size={20} className="flex-shrink-0 text-[#D9A106]" />
          </div>
        </div>

        {/* C. My Examinations -- polished empty state only. No Supabase
            call, no fictional records -- deliberately out of scope for
            this stage. */}
        <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
              <Folder size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#102A43]">My Examinations</h2>
              <p className="text-xs font-medium text-black/50">
                Your examination projects
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-[#F8FBFF] p-6 text-center">
            <p className="text-sm font-bold text-[#102A43]">No examinations yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-black/60">
              Your examination projects will appear here once you create or start
              marking an examination.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
