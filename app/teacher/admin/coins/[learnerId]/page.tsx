import Link from "next/link";
import { notFound } from "next/navigation";
import { neueHaas } from "@/app/fonts";
import { authorizeAdministrator } from "@/lib/supabase/teacherAuth";
import { getAdminLearnerCoinHistory } from "@/lib/supabase/adminCoinReader";
import { AdminLearnerCoinAccountView } from "@/components/admin/AdminLearnerCoinAccountView";

export const dynamic = "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// AD ASTRA ADMINISTRATOR HUB -- COIN VIEWER, STAGE 1 / MANUAL ADJUSTMENTS,
// STAGE 2. This is NOT the public share-token pattern -- there is no
// unauthenticated path to this data at all. Every request:
//   1. authorises the caller as a genuine administrator
//      (authorizeAdministrator(), the same canonical mechanism the
//      existing admin-only accessibility route already uses);
//   2. only THEN loads the requested learner's history.
// A guessed learner UUID never bypasses this -- authorization happens
// before the learnerId is ever used for anything, and a non-existent
// learner gets the exact same notFound() as an unauthorised caller.
//
// This Server Component owns authorisation and the initial data fetch
// only -- all interactivity (the Adjust Coins panel, its confirmation
// step, and refreshing the balance/history after a successful write)
// lives in the client AdminLearnerCoinAccountView it renders, which
// re-runs this exact fetch via router.refresh() rather than a separate
// client-side data path.
export default async function TeacherAdminLearnerCoinHistoryPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const { learnerId } = await params;
  if (!uuidPattern.test(learnerId)) {
    notFound();
  }

  const authorization = await authorizeAdministrator();
  if (!authorization.success) {
    notFound();
  }

  const history = await getAdminLearnerCoinHistory(learnerId);
  if (!history) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-16">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link href="/teacher/admin/coins" className="text-sm font-semibold text-[#508DB1]">
            ← Back to Coin Management
          </Link>
          <h1 className={`${neueHaas.className} mt-2 text-2xl font-bold text-[#102A43]`}>
            {history.learnerName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">AD Astra Coin account</p>
        </div>

        <AdminLearnerCoinAccountView learnerId={learnerId} history={history} />
      </div>
    </main>
  );
}
