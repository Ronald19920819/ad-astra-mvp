"use client";

import { useState } from "react";

// Stage A: entitlement only. Renders as a status-only card for a normal
// teacher (canEdit false -- no button at all, not just a disabled one) and
// as an editable card for an administrator. Never renders a diagnosis,
// disability label, or reason -- only the enabled/disabled state.
export function AccessibilitySupportCard({
  learnerId,
  initialEnabled,
  canEdit,
}: {
  learnerId: string;
  initialEnabled: boolean;
  canEdit: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function toggle() {
    if (!canEdit || isSaving) return;

    const nextEnabled = !enabled;
    setIsSaving(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        `/api/administrator/learners/${encodeURIComponent(learnerId)}/accessibility`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: nextEnabled }),
        },
      );
      const result = (await response.json()) as {
        accessibilityEnabled?: boolean;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "This change could not be saved.");
      }

      setEnabled(result.accessibilityEnabled === true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "This change could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mb-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900">
            Accessibility Support
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Provides approved assistive tools for this learner across AD
            Astra.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
              enabled
                ? "bg-green-100 text-green-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {enabled ? "Enabled" : "Disabled"}
          </span>

          {canEdit && (
            <button
              type="button"
              onClick={toggle}
              disabled={isSaving}
              aria-pressed={enabled}
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
            >
              {isSaving ? "Saving..." : enabled ? "Disable" : "Enable"}
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </p>
      )}
    </section>
  );
}
