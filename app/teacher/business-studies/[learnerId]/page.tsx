"use client";
import { useState } from "react";
import Image from "next/image";
import { Indie_Flower, Oxanium } from "next/font/google";
import { learner } from "@/data/learners";

const indieFlower = Indie_Flower({
  weight: "400",
  subsets: ["latin"],
});

const oxanium = Oxanium({
  weight: "600",
  subsets: ["latin"],
});

export default function LearnerProfilePage() {
    const [reviewOpen, setReviewOpen] = useState(false);
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6">
      <div className="max-w-md mx-auto">
        <div className="bg-white/90 backdrop-blur rounded-3xl shadow-sm border border-blue-100 p-4 flex items-center gap-4 mb-6">
          <Image
            src="/ad_astra_logo.png"
            alt="AD Astra Logo"
            width={54}
            height={54}
          />

          <div>
            <p className={`${oxanium.className} text-xl font-semibold text-black tracking-wide`}>
              AD ASTRA
            </p>

            <h1 className={`${indieFlower.className} text-4xl text-black leading-tight`}>
              {learner.name}
            </h1>

            <p className="text-sm text-black">
              Learner Profile
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-blue-100 p-5 mb-5">
          <h2 className={`${indieFlower.className} text-3xl text-black mb-3`}>
            Overview
          </h2>

          <div className="space-y-2 text-sm text-black">
            <p>
              <span className="font-semibold">Latest Mark:</span>{" "}
              {learner.subjects[0].latestMark}%
            </p>

            <p>
              <span className="font-semibold">Focus Area:</span>{" "}
              {learner.subjects[0].focusArea}
            </p>

            <p>
              <span className="font-semibold">Current Activity:</span>{" "}
              Activity 16
            </p>

            <p>
              <span className="font-semibold">Status:</span>{" "}
              Submitted
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-yellow-200 p-5 mb-5">
  <h2 className={`${indieFlower.className} text-3xl text-black mb-3`}>
    Submissions
  </h2>

  <div className="rounded-2xl border border-yellow-200 bg-[#FFF8E6] p-4 text-sm text-black">
    <p className="font-semibold">Activity 16</p>
    <p>Status: Submitted</p>
    <p>Provisional Mark: 21 / 30</p>

    <button
      type="button"
      onClick={() => setReviewOpen(!reviewOpen)}
      className="mt-3 w-full rounded-2xl bg-black py-2 text-center text-sm font-semibold text-white"
    >
      {reviewOpen ? "Hide Review" : "Review"}
    </button>

    {reviewOpen && (
      <div className="mt-4 space-y-3">
        <h3 className={`${indieFlower.className} text-2xl text-black`}>
          Review Activity 16
        </h3>

        <div className="rounded-2xl border border-blue-100 bg-[#EEF7FF] p-4">
          <p className="font-semibold">1a. Define the term recruitment.</p>
          <p className="mt-1">
            Recruitment is the process of bringing in new members into a company.
          </p>
          <p className="mt-2 font-semibold">AI Mark: 1 / 2</p>
          <p>
            AI Feedback: Good idea, but full marks need “attracting applicants to apply for a vacancy.”
          </p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-[#EEF7FF] p-4">
          <p className="font-semibold">1b. Define the term selection.</p>
          <p className="mt-1">
            Selection is choosing an applicant from a pool of applicants.
          </p>
          <p className="mt-2 font-semibold">AI Mark: 2 / 2</p>
          <p>
            AI Feedback: Clear understanding of choosing the most suitable applicant.
          </p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-white p-4">
          <p className="font-semibold mb-2">Teacher Note</p>

          <textarea
            className="w-full min-h-28 rounded-2xl border border-slate-300 p-3 text-sm text-black outline-none focus:border-blue-500"
            placeholder="Add teacher feedback for Activity 16..."
          />

          <button
            type="button"
            className="mt-3 w-full rounded-2xl bg-black py-2 text-center text-sm font-semibold text-white"
          >
            Return Feedback
          </button>
        </div>
      </div>
    )}
  </div>
</div>
        <div className="bg-white rounded-3xl shadow-sm border border-blue-100 p-5">
          <h2 className={`${indieFlower.className} text-3xl text-black mb-3`}>
            Learner Notes
          </h2>

          <textarea
            className="w-full min-h-32 rounded-2xl border border-slate-300 p-3 text-sm text-black outline-none focus:border-blue-500"
            placeholder="Add teacher notes..."
          />

          <button
            type="button"
            className="mt-4 w-full rounded-2xl bg-black py-3 text-center text-sm font-semibold text-white"
          >
            Save Notes
          </button>
        </div>
      </div>
    </main>
  );
}