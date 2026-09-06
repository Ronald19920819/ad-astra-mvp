"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AdminCoinLearnerSummary } from "@/lib/supabase/adminCoinReader";

function formatCoins(amount: number): string {
  return `${amount.toLocaleString("en-ZA")} AC`;
}

function formatLastActivity(timestamp: string | null): string {
  if (!timestamp) return "No activity yet";
  return new Date(timestamp).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// AD ASTRA ADMINISTRATOR HUB -- COIN VIEWER, STAGE 1. Client-only for the
// search box -- the learner list itself is fetched once, server-side, in
// already-sorted order (current balance highest to lowest); this
// component never re-fetches or re-sorts from the server, it only
// filters the already-loaded list by name. Read-only: no Add/Subtract
// Coins action exists anywhere here (Stage 2 scope).
export function AdminCoinLearnerTable({ learners }: { learners: AdminCoinLearnerSummary[] }) {
  const [search, setSearch] = useState("");

  const filteredLearners = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    if (!trimmed) return learners;
    return learners.filter((learner) => learner.learnerName.toLowerCase().includes(trimmed));
  }, [learners, search]);

  return (
    <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#102A43]">Learner Coin Balances</h2>
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search learner name..."
          className="w-full max-w-xs rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 outline-none focus:border-[#508DB1]"
        />
      </div>

      {filteredLearners.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">
          {learners.length === 0 ? "No learners found." : "No learners match this search."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Learner</th>
                <th className="px-3 py-2">Current Balance</th>
                <th className="px-3 py-2">Total Earned</th>
                <th className="px-3 py-2">Total Spent / Deducted</th>
                <th className="px-3 py-2">Last Coin Activity</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLearners.map((learner) => (
                <tr key={learner.learnerId} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-semibold text-slate-900">{learner.learnerName}</td>
                  <td className="px-3 py-3 font-bold text-[#102A43]">{formatCoins(learner.currentBalance)}</td>
                  <td className="px-3 py-3 text-green-700">{formatCoins(learner.totalEarned)}</td>
                  <td className="px-3 py-3 text-slate-600">
                    {learner.totalSpent > 0 ? formatCoins(learner.totalSpent) : "—"}
                  </td>
                  <td className="px-3 py-3 text-slate-500">{formatLastActivity(learner.lastActivityAt)}</td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/teacher/admin/coins/${learner.learnerId}`}
                      className="rounded-full border-2 border-[#102A43] px-3 py-1 text-xs font-bold text-[#102A43]"
                    >
                      View History
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
