"use client";

import { useEffect, useState } from "react";

// AD ASTRA MONTHLY REPORT -- STAGE 4C: "Send Progress Report" + public
// link controls. Rendered ONLY for a finalised report (enforced by the
// caller, MonthlyReportGenerator.tsx's MonthlyReportPreview) -- a draft
// must never be emailed, and this component makes no attempt to work
// for one. Every action here calls a server route that independently
// re-verifies finalisation, teacher authorisation, and recipient
// validity; nothing here is trusted as the actual gate.
export function MonthlyReportDelivery({ reportId }: { reportId: string }) {
  const [shareActive, setShareActive] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(true);
  const [shareActionLoading, setShareActionLoading] = useState(false);
  const [shareError, setShareError] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");

  const [mainRecipient, setMainRecipient] = useState("");
  const [ccRecipients, setCcRecipients] = useState<string[]>([]);
  const [ccDraft, setCcDraft] = useState("");

  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<"idle" | "success" | "error">("idle");
  const [sendError, setSendError] = useState("");

  // Loads the current link status and the learner's registered email
  // (for prefill only -- the teacher may still edit it) once on mount.
  // Deliberately does NOT create a link just by viewing this section --
  // only an explicit "Generate Report Link" click, or a Send, does that.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [shareRes, recipientRes] = await Promise.all([
          fetch(`/api/teacher/reports/${reportId}/share`),
          fetch(`/api/teacher/reports/${reportId}/recipient-default`),
        ]);
        const shareData = await shareRes.json();
        const recipientData = await recipientRes.json();
        if (cancelled) return;
        if (shareRes.ok) {
          setShareActive(Boolean(shareData.active));
          setShareUrl(shareData.url ?? null);
        }
        if (recipientRes.ok && typeof recipientData.email === "string") {
          setMainRecipient(recipientData.email);
        }
      } catch {
        // A failed status load just leaves the section in its loading-
        // resolved-to-nothing state; the teacher can still retry the
        // individual actions below, which each surface their own errors.
      } finally {
        if (!cancelled) setShareLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  async function ensureLink() {
    setShareActionLoading(true);
    setShareError("");
    try {
      const res = await fetch(`/api/teacher/reports/${reportId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensure" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to set up the report link.");
      setShareActive(Boolean(data.active));
      setShareUrl(data.url ?? null);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Unable to set up the report link.");
    } finally {
      setShareActionLoading(false);
    }
  }

  async function disableLink() {
    const confirmed = window.confirm(
      "Disable this report's public link?\n\nAnyone who currently has the link will lose access immediately. A new link (not this same one) can be generated later.",
    );
    if (!confirmed) return;

    setShareActionLoading(true);
    setShareError("");
    try {
      const res = await fetch(`/api/teacher/reports/${reportId}/share`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to disable the report link.");
      setShareActive(Boolean(data.active));
      setShareUrl(null);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Unable to disable the report link.");
    } finally {
      setShareActionLoading(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyFeedback("Link copied.");
    } catch {
      setCopyFeedback("Unable to copy automatically -- select and copy the link manually.");
    }
    setTimeout(() => setCopyFeedback(""), 3000);
  }

  function addCcRecipient() {
    const trimmed = ccDraft.trim();
    if (!trimmed) return;
    setCcRecipients((prev) => [...prev, trimmed]);
    setCcDraft("");
  }

  function removeCcRecipient(index: number) {
    setCcRecipients((prev) => prev.filter((_, i) => i !== index));
  }

  async function sendReport() {
    setSending(true);
    setSendResult("idle");
    setSendError("");
    try {
      const res = await fetch(`/api/teacher/reports/${reportId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mainRecipient, ccRecipients }),
      });
      const data = await res.json();
      if (!res.ok || !data.sent) {
        throw new Error(data.error ?? "Unable to send the report.");
      }
      setSendResult("success");
      // A link must exist once a send has succeeded -- refresh status so
      // the Copy/Disable controls appear immediately without a reload.
      void ensureLink();
    } catch (error) {
      setSendResult("error");
      setSendError(error instanceof Error ? error.message : "Unable to send the report.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div id="send-progress-report" className="rounded-2xl border border-slate-200 p-5 scroll-mt-6">
      <h3 className="text-lg font-bold text-[#102A43]">Send Progress Report</h3>
      <p className="mt-1 text-xs text-slate-500">
        Emails a secure, read-only link to this finalised report. No login is required to view it.
      </p>

      <div className="mt-4 space-y-3">
        <label className="block">
          <p className="mb-1 text-sm font-bold text-[#102A43]">Main Recipient</p>
          <input
            type="email"
            value={mainRecipient}
            onChange={(event) => setMainRecipient(event.target.value)}
            placeholder="learner@example.com"
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#508DB1]"
          />
        </label>

        <div>
          <p className="mb-1 text-sm font-bold text-[#102A43]">CC Recipients</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              value={ccDraft}
              onChange={(event) => setCcDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCcRecipient();
                }
              }}
              placeholder="add@example.com"
              className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#508DB1]"
            />
            <button
              type="button"
              onClick={addCcRecipient}
              className="rounded-2xl border-2 border-[#102A43] px-4 py-2 text-xs font-bold text-[#102A43]"
            >
              Add
            </button>
          </div>
          {ccRecipients.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {ccRecipients.map((cc, index) => (
                <li
                  key={`${cc}-${index}`}
                  className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  {cc}
                  <button
                    type="button"
                    onClick={() => removeCcRecipient(index)}
                    aria-label={`Remove ${cc}`}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {sendError ? <p className="text-xs font-semibold text-red-600">{sendError}</p> : null}
        {sendResult === "success" ? (
          <p className="text-xs font-semibold text-green-700">Report sent successfully.</p>
        ) : null}

        <button
          type="button"
          onClick={() => void sendReport()}
          disabled={sending || !mainRecipient.trim()}
          className="rounded-2xl bg-[#102A43] px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send Report"}
        </button>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="mb-2 text-sm font-bold text-[#102A43]">Public Report Link</p>
        {shareLoading ? (
          <p className="text-xs text-slate-500">Checking link status…</p>
        ) : shareError ? (
          <p className="text-xs font-semibold text-red-600">{shareError}</p>
        ) : shareActive && shareUrl ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-green-700">Public access is active.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="rounded-2xl border-2 border-[#102A43] px-4 py-2 text-xs font-bold text-[#102A43]"
              >
                Copy Report Link
              </button>
              <button
                type="button"
                onClick={() => void disableLink()}
                disabled={shareActionLoading}
                className="rounded-2xl border-2 border-red-300 px-4 py-2 text-xs font-bold text-red-600 disabled:opacity-50"
              >
                Disable Report Link
              </button>
            </div>
            {copyFeedback ? <p className="text-xs text-slate-500">{copyFeedback}</p> : null}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">No active public link for this report.</p>
            <button
              type="button"
              onClick={() => void ensureLink()}
              disabled={shareActionLoading}
              className="rounded-2xl border-2 border-[#102A43] px-4 py-2 text-xs font-bold text-[#102A43] disabled:opacity-50"
            >
              {shareActionLoading ? "Generating…" : "Generate Report Link"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
