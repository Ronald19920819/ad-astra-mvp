"use client";

import { useMemo, useState } from "react";
import type { SubjectEventSummary } from "@/lib/supabase/subjectCommunications";
import { CalendarClock, Pencil, Trash2 } from "lucide-react";

function formatEventDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
}

type EventDraft = {
  id: string | null;
  title: string;
  description: string;
  eventDate: string;
};

const emptyDraft: EventDraft = {
  id: null,
  title: "",
  description: "",
  eventDate: "",
};

export function TeacherSubjectEventsCard({
  subjectId,
  initialEvents,
}: {
  subjectId: string;
  initialEvents: SubjectEventSummary[];
}) {
  const [events, setEvents] = useState(initialEvents);
  const [draft, setDraft] = useState<EventDraft>(emptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const isEditing = Boolean(draft.id);
  const canAddAnother = useMemo(
    () => events.length < 3 || isEditing,
    [events.length, isEditing],
  );

  async function saveEvent() {
    if (isSaving) return;

    setIsSaving(true);
    setError("");
    setFeedback("");

    try {
      const response = await fetch("/api/teacher/subject-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: draft.id ? "update" : "create",
          subjectId,
          eventId: draft.id,
          title: draft.title,
          description: draft.description,
          eventDate: draft.eventDate,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        event?: SubjectEventSummary;
      };

      if (!response.ok || !result.event) {
        throw new Error(result.error || "Unable to save the subject event.");
      }

      setEvents((current) => {
        const remaining = current.filter((event) => event.id !== result.event!.id);
        return [...remaining, result.event!].sort(
          (eventA, eventB) =>
            eventA.eventDate.localeCompare(eventB.eventDate),
        );
      });
      setDraft(emptyDraft);
      setFeedback(draft.id ? "Event updated." : "Event published.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save the subject event.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteEvent(eventId: string) {
    if (isSaving) return;

    setIsSaving(true);
    setError("");
    setFeedback("");

    try {
      const response = await fetch("/api/teacher/subject-events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, eventId }),
      });
      const result = (await response.json()) as { error?: string; success?: boolean };
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to delete the subject event.");
      }

      setEvents((current) => current.filter((event) => event.id !== eventId));
      setDraft((current) => (current.id === eventId ? emptyDraft : current));
      setFeedback("Event deleted.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete the subject event.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function editEvent(event: SubjectEventSummary) {
    setDraft({
      id: event.id,
      title: event.title,
      description: event.description ?? "",
      eventDate: event.eventDate,
    });
    setError("");
    setFeedback("");
  }

  return (
    <section className="mb-5 rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-2xl bg-[#FFF3E6] p-3 text-[#F97316]">
          <CalendarClock size={22} />
        </div>

        <div>
          <h2 className="text-lg font-bold text-[#102A43]">Upcoming Events</h2>
          <p className="text-xs font-medium text-black/50">
            Up to three active subject events
          </p>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="mb-4 text-sm text-black/60">
          No active events have been published for this subject yet.
        </p>
      ) : (
        <div className="mb-4 space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-2xl border border-orange-100 bg-[#FFFDF9] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#102A43]">{event.title}</p>
                  <p className="mt-1 text-xs font-medium text-black/60">
                    {formatEventDate(event.eventDate)}
                  </p>
                  {event.description && (
                    <p className="mt-2 text-sm text-black/70">
                      {event.description}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => editEvent(event)}
                    className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#F97316] shadow-sm"
                  >
                    <span className="flex items-center gap-1">
                      <Pencil size={14} />
                      Edit
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteEvent(event.id)}
                    className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow-sm"
                  >
                    <span className="flex items-center gap-1">
                      <Trash2 size={14} />
                      Delete
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3 rounded-2xl border border-orange-100 bg-[#FFFDF9] p-4">
        <input
          value={draft.title}
          onChange={(event) =>
            setDraft((current) => ({ ...current, title: event.target.value }))
          }
          placeholder="Event title"
          className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none"
        />
        <input
          type="date"
          value={draft.eventDate}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              eventDate: event.target.value,
            }))
          }
          className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none"
        />
        <textarea
          value={draft.description}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          placeholder="Optional short description"
          rows={3}
          className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none"
        />

        {error && (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        {feedback && (
          <p className="rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            {feedback}
          </p>
        )}

        <div className="flex gap-3">
          {isEditing && (
            <button
              type="button"
              onClick={() => setDraft(emptyDraft)}
              className="flex-1 rounded-2xl border border-orange-100 bg-white py-3 text-sm font-semibold text-[#102A43]"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            disabled={
              isSaving ||
              !canAddAnother ||
              !draft.title.trim() ||
              !draft.eventDate
            }
            onClick={() => void saveEvent()}
            className="flex-1 rounded-2xl bg-[#102A43] py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSaving
              ? "Saving..."
              : isEditing
                ? "Update Event"
                : canAddAnother
                  ? "+ Add Event"
                  : "Maximum reached"}
          </button>
        </div>
      </div>
    </section>
  );
}
