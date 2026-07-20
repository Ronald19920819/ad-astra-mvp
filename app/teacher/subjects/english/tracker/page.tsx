import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  XCircle,
} from "lucide-react";

export default function EnglishLearningTrackerPage() {
  const lessons = [
    {
      lesson: "Lesson 2.7",
      title: "Creating Original Characters",
      open: true,
      learners: [
        {
          name: "Danielle Coetzee",
          video: "complete",
          reading: "complete",
          quiz: "complete",
          status: "On Track",
        },
        {
          name: "Liam Jacobs",
          video: "partial",
          reading: "complete",
          quiz: "complete",
          status: "Needs Support",
        },
        {
          name: "Mia Botha",
          video: "missing",
          reading: "missing",
          quiz: "missing",
          status: "At Risk",
        },
      ],
    },
    {
      lesson: "Lesson 2.6",
      title: "Recognising an Author's Style",
      open: false,
      learners: [
        {
          name: "Danielle Coetzee",
          video: "complete",
          reading: "complete",
          quiz: "complete",
          status: "On Track",
        },
        {
          name: "Liam Jacobs",
          video: "complete",
          reading: "partial",
          quiz: "complete",
          status: "On Track",
        },
        {
          name: "Mia Botha",
          video: "partial",
          reading: "complete",
          quiz: "partial",
          status: "Needs Support",
        },
      ],
    },
  ];

  const progressIcon = (value: string) => {
    if (value === "complete") {
      return <CheckCircle2 className="mx-auto text-green-600" size={20} />;
    }

    if (value === "partial") {
      return <CircleAlert className="mx-auto text-yellow-500" size={20} />;
    }

    return <XCircle className="mx-auto text-red-500" size={20} />;
  };

  return (
    <main className="min-h-screen bg-slate-100 pb-24">
      <div className="mx-auto max-w-md px-4 pt-4">
        {/* Compact Header */}
        <div className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <Link
            href="/teacher/subjects/english"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-500"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>

          <h1 className="text-3xl font-bold text-slate-900">
            Learning Tracker
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            English Faculty
          </p>
        </div>

        {/* Tracker Explanation */}
        <div className="mb-5 rounded-[2rem] border border-blue-100 bg-blue-50 p-5">
          <h2 className="mb-2 font-bold text-slate-900">
            Lesson evidence tracker
          </h2>

          <p className="text-sm leading-relaxed text-slate-600">
            Open a lesson to view learner engagement. Video and reading evidence
            is supported by the post-lecture quiz, which checks simple points
            from the video and reading.
          </p>
        </div>

        {/* Lesson Dropdown Tables */}
        <div className="space-y-4">
          {lessons.map((lesson) => (
            <details
              key={lesson.lesson}
              open={lesson.open}
              className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm"
            >
              <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 text-left">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {lesson.lesson} - {lesson.title}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Tap to view learner lesson participation
                  </p>
                </div>

                <div className="rounded-full bg-blue-50 p-2 text-blue-500">
                  <ChevronDown size={20} />
                </div>
              </summary>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-blue-100">
                <table className="w-full min-w-[430px] table-fixed text-xs">
                  <thead className="bg-blue-50 text-slate-700">
                    <tr>
                      <th className="w-[32%] p-3 text-left">Learner</th>
                      <th className="w-[14%] p-3 text-center">Video</th>
                      <th className="w-[16%] p-3 text-center">Reading</th>
                      <th className="w-[14%] p-3 text-center">Quiz</th>
                      <th className="w-[24%] p-3 text-center">Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {lesson.learners.map((learner, index) => (
                      <tr
                        key={index}
                        className="border-t border-blue-100 bg-white"
                      >
                        <td className="p-3 font-semibold text-slate-900">
                          {learner.name}
                        </td>

                        <td className="p-3 text-center">
                          {progressIcon(learner.video)}
                        </td>

                        <td className="p-3 text-center">
                          {progressIcon(learner.reading)}
                        </td>

                        <td className="p-3 text-center">
                          {progressIcon(learner.quiz)}
                        </td>

                        <td className="p-3 text-center align-middle">
                          <span
                            className={`mx-auto flex w-fit items-center justify-center rounded-full px-2 py-1 text-center text-[10px] font-semibold leading-tight ${
                              learner.status === "On Track"
                                ? "bg-green-100 text-green-700"
                                : learner.status === "Needs Support"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {learner.status}
                          </span>
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