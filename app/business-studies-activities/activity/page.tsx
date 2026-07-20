"use client";

import {
  getPublishedActivity,
  type PublishedActivity,
} from "@/lib/supabase/activityReader";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Rocket,
  Sparkles,
  X,
} from "lucide-react";

export default function BusinessStudiesActivityWorkspacePage() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  

const [activity, setActivity] = useState<PublishedActivity | null>(null);
const [isLoadingActivity, setIsLoadingActivity] = useState(true);
const [activityError, setActivityError] = useState("");

const questions = activity?.activity_questions ?? [];
  const launchActivity = () => {
    setShowConfirm(false);
    setShowSummary(true);
  };
useEffect(() => {
  async function loadActivity() {
    try {
      setIsLoadingActivity(true);
      setActivityError("");

      const publishedActivity = await getPublishedActivity(
        "5cec59e6-fa8b-4ee4-8b0a-2386e93cea50"
      );

      setActivity(publishedActivity);
    } catch (error) {
      console.error("Load activity error:", error);

      setActivityError(
        error instanceof Error
          ? error.message
          : "The activity could not be loaded."
      );
    } finally {
      setIsLoadingActivity(false);
    }
  }

  loadActivity();
}, []);
  return (
    <main className="min-h-screen bg-slate-100 pb-24">
      <div className="mx-auto max-w-md px-4 pt-4">
        {/* Header */}
        <div className="mb-5 rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
          <Link
            href="/business-studies-activities"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-orange-500"
          >
            <ArrowLeft size={16} />
            Back to Activities
          </Link>
<h1 className="text-3xl font-bold text-slate-900">
  {isLoadingActivity
    ? "Loading activity..."
    : activity?.title ?? "Activity unavailable"}
</h1>

<p className="mt-1 text-sm font-semibold text-slate-700">
  {isLoadingActivity
    ? "Loading activity details..."
    : activity
      ? `Market Changes • ${activity.total_marks} Marks${
          activity.due_date
            ? ` • Due: ${new Date(activity.due_date).toLocaleDateString("en-ZA")}`
            : ""
        }`
      : "No published activity available"}
</p>

<p className="mt-2 text-sm text-slate-500">
  Business Studies Activity Workspace
</p>
        </div>

        {/* Lesson Image */}
        <div className="mb-5 overflow-hidden rounded-[2rem] border border-orange-100 bg-black shadow-sm">
  <Image
    src="/kingdom-business-studies.png"
    alt="Business Studies Lesson"
    width={1400}
    height={1050}
    priority
    className="h-auto w-full object-contain"
  />
</div>

        {/* Reading Card */}
        <div className="mb-5 rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-orange-50 p-3">
              <BookOpen className="text-orange-500" size={22} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Business Studies Reading
              </h2>
              <p className="text-sm text-slate-500">
                Reading Reference: Lesson 2.7 - Market Changes
              </p>
            </div>
          </div>

          <div className="max-h-[350px] overflow-y-auto rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            <h3 className="mb-3 font-bold text-slate-900">
              Market Changes
            </h3>

            <p className="mb-3">
              Markets are always changing. A market can change because customer
              needs change, competitors enter the market, prices rise, new
              technology appears, or economic conditions become more difficult.
              Businesses must pay attention to these changes so that they can
              respond before they lose customers.
            </p>

            <p className="mb-3">
              One important market change is a change in customer tastes.
              Customers may stop buying one product and start buying another.
              For example, customers may prefer healthier food, online shopping,
              or cheaper alternatives. A business that notices these changes can
              adjust its products and marketing.
            </p>

            <p className="mb-3">
              Competition can also change a market. When new businesses enter a
              market, customers have more choice. This may force existing
              businesses to improve quality, lower prices, offer better service,
              or promote their products more effectively.
            </p>

            <p>
              Successful businesses monitor the market and adapt. If they ignore
              market changes, they may lose sales, profits and customer loyalty.
              Responding to market changes helps a business remain competitive.
            </p>
          </div>
        </div>

        {/* Activity Questions */}
    <div className="mb-5 rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
  <h2 className="mb-4 text-xl font-bold text-slate-900">
    Activity Questions
  </h2>

  {isLoadingActivity ? (
  <p className="text-sm text-slate-500">Loading activity...</p>
) : activityError ? (
  <p className="text-sm font-semibold text-red-600">
    {activityError}
  </p>
) : !activity ? (
  <p className="text-sm text-slate-500">
    No published activity is available for this lesson yet.
  </p>
) : (
  <div className="space-y-4">
    {questions.map((item) => (
      <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
        <h3 className="font-bold text-slate-900">
          {item.question_number} ({item.marks} marks)
        </h3>

        <p className="mt-1 text-sm font-semibold text-slate-700">
          {item.question_text}
        </p>

        <textarea
          placeholder="Type your answer here..."
          className="mt-3 min-h-[100px] w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none"
        />
      </div>
    ))}
  </div>
)}
</div>

        {/* Exam Preparation */}
        <div className="mb-5 rounded-[2rem] border border-orange-100 bg-orange-50 p-5">
          <h2 className="mb-3 text-xl font-bold text-slate-900">
            Exam Preparation Guidance
          </h2>

          <div className="space-y-3 text-sm text-slate-700">
            <p>
              <strong>Define:</strong> Give a clear meaning of the term.
            </p>
            <p>
              <strong>Explain:</strong> Make a point and explain how or why it
              affects the business.
            </p>
            <p>
              <strong>Analyse:</strong> Show cause and effect. Explain the
              impact on the business.
            </p>
            <p>
              <strong>Evaluate:</strong> Make a judgement and support it with
              reasons.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowConfirm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-4 text-lg font-bold text-white shadow-sm"
        >
          <Rocket size={20} />
          LAUNCH
        </button>
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-[2rem] bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                Launch Activity?
              </h2>

              <button onClick={() => setShowConfirm(false)}>
                <X size={22} />
              </button>
            </div>

            <p className="mb-5 text-sm leading-relaxed text-slate-600">
              Once you launch, your answers will be submitted and Kingdom will
              generate a draft summary. You will not be able to edit this
              submission.
            </p>

            <button
              onClick={launchActivity}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3 font-semibold text-white"
            >
              <Rocket size={18} />
              Confirm Launch
            </button>

            <button
              onClick={() => setShowConfirm(false)}
              className="w-full rounded-2xl border border-slate-200 py-3 font-semibold text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Kingdom Draft Summary Modal */}
      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-[2rem] bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-orange-50 p-3">
                <Sparkles className="text-orange-500" size={22} />
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Kingdom Draft Summary
                </h2>
                <p className="text-sm text-slate-500">
                  Awaiting teacher review
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-600">
                Kingdom Draft Mark
              </p>
              <p className="text-3xl font-bold text-orange-500">14/20</p>
            </div>

            <p className="mb-5 text-sm leading-relaxed text-slate-700">
              You showed a good understanding of market changes and explained
              key ideas clearly. To improve, develop your analysis more fully
              and use stronger business examples when answering higher-mark
              questions.
            </p>

            <button
              onClick={() => setShowSummary(false)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3 font-semibold text-white"
            >
              <CheckCircle2 size={18} />
              Done
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
