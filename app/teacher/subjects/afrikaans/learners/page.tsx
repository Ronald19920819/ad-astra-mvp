import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  ClipboardCheck,
  Eye,
  FileWarning,
  UserRound,
} from "lucide-react";

export default function AfrikaansLearnersPage() {
  const learners = [
    {
      name: "Danielle Coetzee",
      status: "On Track",
      engagement: "92%",
      activities: "7/8",
      average: "78%",
      reviews: "0",
    },
    {
      name: "Liam Jacobs",
      status: "Needs Support",
      engagement: "71%",
      activities: "6/8",
      average: "64%",
      reviews: "2",
    },
    {
      name: "Mia Botha",
      status: "At Risk",
      engagement: "38%",
      activities: "3/8",
      average: "42%",
      reviews: "3",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-100 pb-24">
      <div className="mx-auto max-w-md px-4 pt-4">
        {/* Compact Header */}
        <div className="mb-5 rounded-[2rem] border border-red-100 bg-white p-5 shadow-sm">
          <Link
            href="/teacher/subjects/afrikaans"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-red-500"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>

          <h1 className="text-3xl font-bold text-slate-900">Learners</h1>

          <p className="mt-1 text-sm text-slate-500">
            Afrikaans Faculty
          </p>
        </div>

        {/* Overview */}
        <div className="mb-5 rounded-[2rem] border border-red-100 bg-red-50 p-5">
          <h2 className="mb-2 font-bold text-slate-900">
            Learner subject overview
          </h2>

          <p className="text-sm leading-relaxed text-slate-600">
            View overall learner engagement, activity completion, average marks
            and teacher review needs for this subject.
          </p>
        </div>

        {/* Learner Cards */}
        <div className="space-y-4">
          {learners.map((learner, index) => (
            <div
              key={index}
              className="rounded-[2rem] border border-red-100 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-red-50 p-3">
                    <UserRound className="text-red-500" size={22} />
                  </div>

                  <div>
                    <h2 className="font-bold text-slate-900">
                      {learner.name}
                    </h2>

                    <p className="text-xs text-slate-500">
                      Afrikaans learner
                    </p>
                  </div>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    learner.status === "On Track"
                      ? "bg-green-100 text-green-700"
                      : learner.status === "Needs Support"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {learner.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="mb-1 flex items-center gap-2 font-semibold text-slate-800">
                    <BookOpenCheck size={16} />
                    Engagement
                  </div>
                  <p className="text-lg font-bold text-red-500">
                    {learner.engagement}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="mb-1 flex items-center gap-2 font-semibold text-slate-800">
                    <ClipboardCheck size={16} />
                    Activities
                  </div>
                  <p className="text-lg font-bold text-red-500">
                    {learner.activities}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="mb-1 flex items-center gap-2 font-semibold text-slate-800">
                    <BarChart3 size={16} />
                    Average
                  </div>
                  <p className="text-lg font-bold text-red-500">
                    {learner.average}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="mb-1 flex items-center gap-2 font-semibold text-slate-800">
                    <FileWarning size={16} />
                    Reviews
                  </div>
                  <p className="text-lg font-bold text-red-500">
                    {learner.reviews}
                  </p>
                </div>
              </div>

              <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 py-3 text-sm font-semibold text-white">
                <Eye size={17} />
                View Learner Profile
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-100 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm text-black">
          <Link href="/teacher">
            <div className="py-4">Home</div>
          </Link>

          <Link href="/teacher/subjects">
            <div className="py-4 text-[#508DB1]">Subjects</div>
          </Link>

          <Link href="/teacher/messages">
            <div className="py-4">Messages</div>
          </Link>

          <Link href="/teacher/reports">
            <div className="py-4">Reports</div>
          </Link>

          <Link href="/teacher/profile">
            <div className="py-4">Profile</div>
          </Link>
        </div>
      </nav>
    </main>
  );
}
