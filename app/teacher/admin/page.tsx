import Link from "next/link";
import { notFound } from "next/navigation";
import { Coins, Users } from "lucide-react";
import { neueHaas } from "@/app/fonts";
import { authorizeAdministrator } from "@/lib/supabase/teacherAuth";

export const dynamic = "force-dynamic";

// AD ASTRA ADMINISTRATOR HUB -- STAGE 1. The central, platform-level
// administrative dashboard -- reached from the teacher profile's
// "Administrator" entry, never from subject-specific navigation. Built so
// future modules (learner registrations/approvals, enrolment oversight,
// operational monitoring, OpenAI/Supabase usage, deployment health,
// backups, outstanding-marking alerts -- see this stage's own scope) can
// be added as additional cards later without restructuring this page;
// nothing here assumes Coin Management will remain the only module.
//
// Authorisation is the canonical authorizeAdministrator() helper
// (lib/supabase/teacherAuth.ts) -- the same mechanism already used by
// the existing admin-only accessibility-entitlement route. An ordinary
// teacher (or anyone unauthenticated) gets the exact same notFound()
// this codebase already uses for "you may not see this", matching the
// established security convention rather than a distinct "Access
// Denied" page that would confirm the route exists.
export default async function TeacherAdminHubPage() {
  const authorization = await authorizeAdministrator();
  if (!authorization.success) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-16">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#508DB1]">
            Administrator
          </p>
          <h1 className={`${neueHaas.className} mt-1 text-2xl font-bold text-[#102A43]`}>
            Administrator Hub
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Platform-wide administrative functions.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <AdminHubCard
            icon={<Coins className="text-[#102A43]" size={22} />}
            title="Coin Management"
            description="View learner Ad Astra Coin balances and transaction history."
            actionLabel="Open Coin Management"
            href="/teacher/admin/coins"
          />
          <AdminHubCard
            icon={<Users className="text-[#102A43]" size={22} />}
            title="Learner Subject Management"
            description="Manage learner subject and class enrolments."
            actionLabel="Open Subject Management"
            href="/teacher/subjects"
          />
        </div>
      </div>
    </main>
  );
}

function AdminHubCard({
  icon,
  title,
  description,
  actionLabel,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
      <div>
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-2xl bg-[#FEF3C7] p-2">{icon}</div>
          <h2 className="text-base font-bold text-[#102A43]">{title}</h2>
        </div>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <Link
        href={href}
        className="mt-4 inline-flex w-fit items-center gap-2 rounded-2xl bg-[#102A43] px-4 py-2 text-sm font-bold text-white"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
