"use client";

import { useState } from "react";
import type { SubjectAnnouncementSummary } from "@/lib/supabase/subjectCommunications";
import { MessageSquareText, Trash2 } from "lucide-react";

export function TeacherSubjectAnnouncementCard({
  subjectId,
  initialAnnouncement,
}: {
  subjectId: string;
  initialAnnouncement: SubjectAnnouncementSummary | null;
}) {
  const [announcement, setAnnouncement] = useState(initialAnnouncement);
  const [message, setMessage] = useState(initialAnnouncement?.message ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  async function saveAnnouncement() {
    if (isSaving) return;

    setIsSaving(true);
    setError("");
    setFeedback("");

    try {
      const response = await fetch("/api/teacher/subject-announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, message }),
      });
      const result = (await response.json()) as {
        error?: string;
        announcement?: SubjectAnnouncementSummary;
      };

      if (!response.ok || !result.announcement) {
        throw new Error(
          result.error || "Unable to publish the subject announcement.",
        );
      }

      setAnnouncement(result.announcement);
      setMessage(result.announcement.message);
      setFeedback("Announcement saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to publish the subject announcement.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteAnnouncement() {
    if (isSaving || !announcement) return;

    setIsSaving(true);
    setError("");
    setFeedback("");

    try {
      const response = await fetch("/api/teacher/subject-announcements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId }),
      });
      const result = (await response.json()) as { error?: string; success?: boolean };
      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Unable to remove the subject announcement.",
        );
      }

      setAnnouncement(null);
      setMessage("");
      setFeedback("Announcement removed.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to remove the subject announcement.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mb-5 rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-2xl bg-[#FFF3E6] p-3 text-[#F97316]">
          <MessageSquareText size={22} />
        </div>

        <div>
          <h2 className="text-lg font-bold text-[#102A43]">
            Subject Announcement
          </h2>
          <p className="text-xs font-medium text-black/50">
            One plain-text announcement for this subject
          </p>
        </div>
      </div>

      {announcement && (
        <div className="mb-4 rounded-2xl border border-orange-100 bg-[#FFFDF9] p-4">
          <p className="text-sm font-semibold text-[#102A43]">
            {announcement.message}
          </p>
          <p className="mt-2 text-xs text-black/50">
            Updated{" "}
            {new Date(announcement.updatedAt).toLocaleString("en-ZA", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
      )}

      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        rows={4}
        placeholder="Write a short subject announcement..."
        className="w-full rounded-2xl border border-orange-100 bg-[#FFFDF9] px-4 py-3 text-sm outline-none"
      />

      {error && (
        <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      {feedback && (
        <p className="mt-3 rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {feedback}
        </p>
      )}

      <div className="mt-4 flex gap-3">
        {announcement && (
          <button
            type="button"
            onClick={() => void deleteAnnouncement()}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm font-semibold text-red-600 disabled:opacity-60"
          >
            <Trash2 size={16} />
            Delete
          </button>
        )}
        <button
          type="button"
          onClick={() => void saveAnnouncement()}
          disabled={isSaving || !message.trim()}
          className="flex-1 rounded-2xl bg-[#102A43] py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isSaving
            ? "Saving..."
            : announcement
              ? "Update Announcement"
              : "Publish Announcement"}
        </button>
      </div>
    </section>
  );
}
