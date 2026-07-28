import type { SubjectEventSummary } from "@/lib/supabase/subjectCommunications";
import { CalendarClock } from "lucide-react";

function formatEventDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
}

export function SubjectImportantDatesCard({
  events,
}: {
  events: SubjectEventSummary[];
}) {
  return (
    <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-2xl bg-[var(--subject-soft)] p-3 text-[var(--subject-primary)]">
          <CalendarClock size={22} />
        </div>

        <div>
          <h2 className="text-lg font-bold text-[#102A43]">Subject Announcements</h2>
          <p className="text-xs font-medium text-black/50">
            Important subject-specific dates published by your teacher
          </p>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="text-sm font-medium text-slate-500">
          No subject announcements at this time.
        </p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-2xl border border-blue-100 bg-[#F8FBFF] px-4 py-3"
            >
              <p className="text-sm font-bold text-[#102A43]">{event.title}</p>
              <p className="mt-1 text-xs font-medium text-black/60">
                {formatEventDate(event.eventDate)}
              </p>
              {event.description && (
                <p className="mt-2 text-sm text-black/70">{event.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
