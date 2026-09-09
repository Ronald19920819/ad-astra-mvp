"use client";

import { useState } from "react";
import { resolveCoinTransactionTypeLabel } from "@/lib/coins/coinTransactionTypeLabels";
import type { AdminAdjustableCoinTransactionType } from "@/lib/supabase/coinLedger";
import type { AdminCoinTransactionEntry } from "@/lib/supabase/adminCoinReader";

const CATEGORY_OPTIONS: readonly AdminAdjustableCoinTransactionType[] = [
  "admin_adjustment",
  "correction",
  "competition_award",
  "promotional_award",
  "special_achievement",
];

function formatCoins(amount: number): string {
  return `${amount.toLocaleString("en-ZA")} AC`;
}

function formatSignedCoins(amount: number): string {
  return `${amount > 0 ? "+" : amount < 0 ? "−" : ""}${Math.abs(amount).toLocaleString("en-ZA")} AC`;
}

// AD ASTRA ADMINISTRATOR COIN MANAGEMENT -- STAGE 2. The compact, two-step
// (edit -> confirm) manual adjustment form. The learner's current balance
// stays visible throughout. The administrator never types a negative
// number -- adjustmentType (Add/Subtract) and a positive amount are
// combined into a signed amount only server-side; this form's own
// preview arithmetic is a courtesy for the confirmation step, never
// treated as authoritative (the server independently recomputes the
// balance and re-enforces the >= 0 floor before writing anything).
export function AdjustCoinsForm({
  learnerId,
  learnerName,
  currentBalance,
  recentTransactions,
  onCancel,
  onSuccess,
}: {
  learnerId: string;
  learnerName: string;
  currentBalance: number;
  recentTransactions: AdminCoinTransactionEntry[];
  onCancel: () => void;
  onSuccess: (message: string) => void;
}) {
  const [adjustmentType, setAdjustmentType] = useState<"add" | "subtract">("add");
  const [amountInput, setAmountInput] = useState("");
  const [category, setCategory] = useState<AdminAdjustableCoinTransactionType>("admin_adjustment");
  const [reason, setReason] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [referenceTransactionId, setReferenceTransactionId] = useState("");
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const parsedAmount = Number(amountInput);
  const isAmountValid =
    amountInput.trim() !== "" && Number.isInteger(parsedAmount) && parsedAmount > 0;
  const signedAmount = isAmountValid ? (adjustmentType === "add" ? parsedAmount : -parsedAmount) : 0;
  const previewNewBalance = currentBalance + signedAmount;

  function goToConfirm() {
    setError("");
    if (!isAmountValid) {
      setError("Enter a whole number of Coins greater than 0.");
      return;
    }
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    if (category === "correction" && !referenceTransactionId) {
      setError("Select the transaction this correction relates to.");
      return;
    }
    if (adjustmentType === "subtract" && previewNewBalance < 0) {
      setError("This adjustment would reduce the learner's balance below 0 AC.");
      return;
    }
    setStep("confirm");
  }

  async function submit() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/teacher/admin/coins/${learnerId}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adjustmentType,
          amount: parsedAmount,
          category,
          reason: reason.trim(),
          adminNote: adminNote.trim() || undefined,
          referenceTransactionId: category === "correction" ? referenceTransactionId : undefined,
        }),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to record this Coin adjustment.");
      }
      onSuccess(
        adjustmentType === "add"
          ? `${formatCoins(parsedAmount)} added successfully.`
          : `${formatCoins(parsedAmount)} deducted successfully.`,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to record this Coin adjustment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[#102A43]/20 bg-[#F8FBFF] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#102A43]">Adjust Coins</h3>
        <span className="text-xs font-semibold text-slate-500">
          Current Balance: {formatCoins(currentBalance)}
        </span>
      </div>

      {step === "edit" ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAdjustmentType("add")}
              className={`flex-1 rounded-2xl px-4 py-2 text-sm font-bold ${
                adjustmentType === "add" ? "bg-[#102A43] text-white" : "border border-slate-300 text-slate-600"
              }`}
            >
              Add Coins
            </button>
            <button
              type="button"
              onClick={() => setAdjustmentType("subtract")}
              className={`flex-1 rounded-2xl px-4 py-2 text-sm font-bold ${
                adjustmentType === "subtract" ? "bg-[#102A43] text-white" : "border border-slate-300 text-slate-600"
              }`}
            >
              Subtract Coins
            </button>
          </div>

          <label className="block">
            <p className="mb-1 text-xs font-bold text-[#102A43]">Amount</p>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
              placeholder="e.g. 500"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 outline-none focus:border-[#508DB1]"
            />
          </label>

          <label className="block">
            <p className="mb-1 text-xs font-bold text-[#102A43]">Category</p>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as AdminAdjustableCoinTransactionType)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 outline-none focus:border-[#508DB1]"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {resolveCoinTransactionTypeLabel(option)}
                </option>
              ))}
            </select>
          </label>

          {category === "correction" ? (
            <label className="block">
              <p className="mb-1 text-xs font-bold text-[#102A43]">Related Transaction</p>
              <select
                value={referenceTransactionId}
                onChange={(event) => setReferenceTransactionId(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 outline-none focus:border-[#508DB1]"
              >
                <option value="">Select the transaction being corrected…</option>
                {recentTransactions.map((transaction) => (
                  <option key={transaction.id} value={transaction.id}>
                    {new Date(transaction.createdAt).toLocaleDateString("en-ZA", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {formatSignedCoins(transaction.amount)} ·{" "}
                    {resolveCoinTransactionTypeLabel(transaction.transactionType)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block">
            <p className="mb-1 text-xs font-bold text-[#102A43]">Reason</p>
            <input
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Correction for missed Coin award"
              maxLength={500}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 outline-none focus:border-[#508DB1]"
            />
          </label>

          <label className="block">
            <p className="mb-1 text-xs font-bold text-[#102A43]">Admin Note (optional)</p>
            <textarea
              value={adminNote}
              onChange={(event) => setAdminNote(event.target.value)}
              placeholder="Internal context for other administrators..."
              rows={2}
              maxLength={2000}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 outline-none focus:border-[#508DB1]"
            />
          </label>

          {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={goToConfirm}
              className="rounded-2xl bg-[#102A43] px-5 py-2 text-sm font-bold text-white"
            >
              Review Adjustment
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-2xl border-2 border-[#102A43] px-5 py-2 text-sm font-bold text-[#102A43]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
            <p>
              <span className="font-semibold text-slate-500">Learner:</span> {learnerName}
            </p>
            <p>
              <span className="font-semibold text-slate-500">Current Balance:</span>{" "}
              {formatCoins(currentBalance)}
            </p>
            <p>
              <span className="font-semibold text-slate-500">Adjustment:</span>{" "}
              <span className={signedAmount > 0 ? "text-green-700" : "text-red-600"}>
                {formatSignedCoins(signedAmount)}
              </span>
            </p>
            <p>
              <span className="font-semibold text-slate-500">New Balance:</span>{" "}
              <span className="font-bold text-[#102A43]">{formatCoins(previewNewBalance)}</span>
            </p>
            <p>
              <span className="font-semibold text-slate-500">Category:</span>{" "}
              {resolveCoinTransactionTypeLabel(category)}
            </p>
            <p>
              <span className="font-semibold text-slate-500">Reason:</span> {reason}
            </p>
          </div>

          {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={isSubmitting}
              className="rounded-2xl bg-[#102A43] px-5 py-2 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
            >
              {isSubmitting ? "Submitting…" : "Confirm & Submit"}
            </button>
            <button
              type="button"
              onClick={() => setStep("edit")}
              disabled={isSubmitting}
              className="rounded-2xl border-2 border-[#102A43] px-5 py-2 text-sm font-bold text-[#102A43] disabled:opacity-60"
            >
              Back to Edit
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
