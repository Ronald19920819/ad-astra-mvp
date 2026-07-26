"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, UserCheck, X } from "lucide-react";
import type { LearnerApprovalRequest } from "@/lib/approvals/learnerApprovals";
import { neueHaas } from "@/app/fonts";

export default function LearnerApprovalsPage() {
  const [requests, setRequests] = useState<LearnerApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    void fetch("/api/teacher/learner-approvals", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          requests?: LearnerApprovalRequest[];
          error?: string;
        };
        if (!isActive) return;
        if (!response.ok) {
          setError(
            data.error ?? "Unable to load learner approval requests.",
          );
          return;
        }
        setRequests(data.requests ?? []);
      })
      .catch((loadError: unknown) => {
        console.error("Unable to load learner approvals:", loadError);
        if (isActive) setError("Unable to load learner approval requests.");
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  async function reviewRequest(
    requestId: string,
    action: "approve" | "decline",
  ) {
    try {
      setReviewingId(requestId);
      setError("");
      const response = await fetch(
        `/api/teacher/learner-approvals/${requestId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Unable to review this request.");
        return;
      }
      setRequests((current) =>
        current.filter((request) => request.id !== requestId),
      );
    } catch (reviewError) {
      console.error("Unable to review learner approval:", reviewError);
      setError("Unable to review this request.");
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-4 pb-12 sm:p-6`}
    >
      <div className="mx-auto max-w-2xl">
        <Link
          href="/teacher/profile"
          className="mb-5 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#102A43] shadow-sm"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Back to Profile
        </Link>

        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
                <UserCheck size={24} aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#102A43]">
                  Learner Approvals
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Review subject requests for the subjects you teach.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-[#102A43] px-3 py-1 text-sm font-bold text-white">
              {requests.length}
            </span>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              {error}
            </p>
          )}

          {isLoading ? (
            <p className="mt-6 text-sm font-medium text-slate-600">
              Loading learner approval requests...
            </p>
          ) : requests.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-[#F8FBFF] p-5 text-center">
              <p className="font-semibold text-[#102A43]">
                No learner approval requests are waiting.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {requests.map((request) => {
                const isReviewing = reviewingId === request.id;

                return (
                  <article
                    key={request.id}
                    className="rounded-[1.5rem] border border-blue-100 bg-[#F8FBFF] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-bold text-[#102A43]">
                          {request.learnerName}
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                          {request.learnerEmail ?? "Email unavailable"}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                        Pending
                      </span>
                    </div>

                    <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="font-semibold text-slate-700">Subject</dt>
                        <dd>{request.subjectName}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-700">
                          Grade / Stage
                        </dt>
                        <dd>{request.gradeOrStage ?? "Not supplied"}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-700">School</dt>
                        <dd>{request.school ?? "Not supplied"}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-700">
                          Requested
                        </dt>
                        <dd>
                          {new Intl.DateTimeFormat("en-ZA", {
                            dateStyle: "medium",
                          }).format(new Date(request.requestedAt))}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={isReviewing}
                        onClick={() =>
                          void reviewRequest(request.id, "approve")
                        }
                        className="flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-60"
                      >
                        <Check size={18} aria-hidden="true" />
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={isReviewing}
                        onClick={() =>
                          void reviewRequest(request.id, "decline")
                        }
                        className="flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-60"
                      >
                        <X size={18} aria-hidden="true" />
                        Decline
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
