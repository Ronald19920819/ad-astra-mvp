import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileSearch,
  XCircle,
} from "lucide-react";

export default function AfikaansActivityReviewPage() {
  const activities = [
    {
      activity: "Aktiwiteit 7",
      title: "Begripstoets",
      total: 30,
      open: true,
      learners: [
        {
          name: "Danielle Coetzee",
          submitted: true,
          aiReview: "24/30",
          teacherReview: "Pending",
        },
        {
          name: "Liam Jacobs",
          submitted: true,
          aiReview: "18/30",
          teacherReview: "Pending",
        },
        {
          name: "Mia Botha",
          submitted: false,
          aiReview: "No draft",
          teacherReview: "Missing",
        },
      ],
    },
    {
      activity: "Aktiwiteit 6",
      title: "Taalstrukture",
      total: 30,
      open: false,
      learners: [
        {
          name: "Danielle Coetzee",
          submitted: true,
          aiReview: "26/30",
          teacherReview: "27/30",
        },
        {
          name: "Liam Jacobs",
          submitted: true,
          aiReview: "21/30",
          teacherReview: "22/30",
        },
        {
          name: "Mia Botha",
          submitted: true,
          aiReview: "17/30",
          teacherReview: "Pending",
        },
      ],
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

          <h1 className="text-3xl font-bold text-slate-900">
            Activity Review
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Afrikaans Faculty
          </p>
        </div>

        {/* Explanation */}
        <div className="mb-5 rounded-[2rem] border border-red-100 bg-red-50 p-5">
          <h2 className="mb-2 font-bold text-slate-900">
            Teacher review centre
          </h2>

          <p className="text-sm leading-relaxed text-slate-600">
            Kingdom provides a draft review first. The teacher review is the
            official final mark that will be returned to the learner.
          </p>
        </div>

        {/* Activity Review Tables */}
        <div className="space-y-4">
          {activities.map((activity) => (
            <details
              key={activity.activity}
              open={activity.open}
              className="rounded-[2rem] border border-red-100 bg-white p-5 shadow-sm"
            >
              <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 text-left">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {activity.activity} - {activity.title}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Total: {activity.total} marks
                  </p>
                </div>

                <div className="rounded-full bg-red-50 p-2 text-red-500">
                  <ChevronDown size={20} />
                </div>
              </summary>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-red-100">
                <table className="w-full min-w-[560px] table-fixed text-xs">
                  <thead className="bg-red-50 text-slate-700">
                    <tr>
                      <th className="w-[25%] p-3 text-left">Learner</th>
                      <th className="w-[16%] p-3 text-center">Submission</th>
                      <th className="w-[20%] p-3 text-center">
                        AI Review Draft
                      </th>
                      <th className="w-[22%] p-3 text-center">
                        Teacher Final
                      </th>
                      <th className="w-[17%] p-3 text-center">Review</th>
                    </tr>
                  </thead>

                  <tbody>
                    {activity.learners.map((learner, index) => (
                      <tr
                        key={index}
                        className="border-t border-red-100 bg-white"
                      >
                        <td className="p-3 font-semibold text-slate-900">
                          {learner.name}
                        </td>

                        <td className="p-3 text-center">
                          {learner.submitted ? (
                            <CheckCircle2
                              className="mx-auto text-green-600"
                              size={20}
                            />
                          ) : (
                            <XCircle
                              className="mx-auto text-red-500"
                              size={20}
                            />
                          )}
                        </td>

                        <td className="p-3 text-center font-semibold text-slate-700">
                          {learner.aiReview}
                        </td>

                        <td className="p-3 text-center">
                          <span
                            className={`mx-auto flex w-fit items-center justify-center rounded-full px-2 py-1 text-center text-[10px] font-semibold leading-tight ${
                              learner.teacherReview === "Pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : learner.teacherReview === "Missing"
                                ? "bg-red-100 text-red-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {learner.teacherReview}
                          </span>
                        </td>

                        <td className="p-3 text-center">
                          <Link
                            href="/teacher/subjects/afrikaans/review/submission"
                            className="mx-auto flex w-fit items-center justify-center gap-1 rounded-full bg-red-500 px-3 py-2 text-[10px] font-semibold text-white"
                          >
                            <FileSearch size={13} />
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
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