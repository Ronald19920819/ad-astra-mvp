import Link from "next/link";
import {
  ArrowLeft,
  Download,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import {
  businessStudiesSubmissionReview,
  businessStudiesMockSubmission,
} from "@/app/data/BSMock";

export default function BusinessStudiesSubmissionReviewPage() {
  const submission = businessStudiesSubmissionReview;
  const questions = submission.questions;
  const mockSubmission = businessStudiesMockSubmission;
  return (
    <main className="min-h-screen bg-slate-100 pb-24">
      <div className="mx-auto max-w-md px-4 pt-4">
        {/* Header */}
        <div className="mb-5 rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
          <Link
            href="/teacher/subjects/business-studies/review"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-orange-500"
          >
            <ArrowLeft size={16} />
            Back to Activity Review
          </Link>

          <h1 className="text-3xl font-bold text-slate-900">
            Submission Review
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Business Studies Faculty
          </p>
        </div>

        {/* Activity Details */}
        <div className="mb-5 rounded-[2rem] border border-orange-100 bg-orange-50 p-5">
          <h2 className="text-lg font-bold text-slate-900">
            {submission.activityTitle}
          </h2>

          <p className="mt-1 text-sm font-semibold text-slate-700">
            {submission.topic} • {submission.totalMarks} Marks • Due:{" "}
            {submission.dueDate}
          </p>

          <p className="mt-3 text-sm text-slate-600">
            Learner: {mockSubmission.learner}
          </p>
        </div>

        {/* Question-by-question review */}
        <div className="space-y-5">
          {questions.map((item) => (
            <div
              key={item.number}
              className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm"
            >
              <div className="mb-3">
                <h2 className="font-bold text-slate-900">
                  {item.number} ({item.marks} marks)
                </h2>

                <p className="mt-1 text-sm font-semibold text-slate-700">
                  {item.question}
                </p>
              </div>

              <div className="mb-4 rounded-2xl bg-slate-50 p-4">
                <p className="mb-1 text-xs font-bold text-slate-500">
                  Learner Answer
                </p>

                <p className="text-sm leading-relaxed text-slate-700">
                  {mockSubmission.answers.find((answer) => answer.number === item.number)?.answer}
                </p>
              </div>

              <div className="mb-4 rounded-2xl border border-orange-100 bg-orange-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="text-orange-500" size={17} />
                  <p className="text-sm font-bold text-slate-900">
                    Kingdom Draft Result
                  </p>
                </div>

                <p className="mb-2 text-sm leading-relaxed text-slate-700">
                  {item.kingdomComment}
                </p>

                <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                  ✓ {item.kingdomMark}
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="mb-3 text-sm font-bold text-slate-900">
                  Teacher Final Review
                </p>

                <label className="mb-2 block text-xs font-semibold text-slate-600">
                  Teacher Mark
                </label>

                <div className="mb-3 flex items-center gap-2">
                  <input
                    placeholder={item.kingdomMark.split("/")[0]}
                    className="w-20 rounded-2xl border border-slate-200 p-3 text-center text-sm font-bold outline-none"
                  />
                  <span className="text-sm font-semibold text-slate-600">
                    /{item.marks}
                  </span>
                </div>

                <label className="mb-2 block text-xs font-semibold text-slate-600">
                  Teacher Comment
                </label>

                <textarea
                  placeholder="Confirm or adjust Kingdom's feedback..."
                  className="min-h-[90px] w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Final Review Actions */}
        <div className="mt-5 rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-slate-900">
            Final Review
          </h2>

          <div className="mb-4 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-600">
              Kingdom Draft Final Mark
            </p>
            <p className="text-2xl font-bold text-orange-500">
              {submission.kingdomFinalMark}
            </p>
            <p className="text-sm text-slate-500">
              {submission.kingdomPercentage}
            </p>
          </div>

          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Teacher Final Mark
          </label>

          <div className="mb-4 flex items-center gap-3">
            <input
              placeholder={submission.teacherFinalMarkPlaceholder}
              className="w-24 rounded-2xl border border-slate-200 p-3 text-center font-bold outline-none"
            />
            <span className="font-semibold text-slate-600">
              /{submission.totalMarks}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button className="flex items-center justify-center gap-2 rounded-2xl border border-orange-100 bg-white py-3 text-sm font-semibold text-orange-500">
              <Download size={17} />
              Save PDF
            </button>

            <button className="flex items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3 text-sm font-semibold text-white">
              <RotateCcw size={17} />
              Return
            </button>
          </div>

          <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white">
            <Save size={17} />
            Save Draft Review
          </button>
        </div>
      </div>
    </main>
  );
}