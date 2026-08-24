export const SOUTH_AFRICA_TIME_ZONE = "Africa/Johannesburg";

export function dateKeyInTimeZone(
  date: Date,
  timeZone = SOUTH_AFRICA_TIME_ZONE,
) {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function deadlineDateKey(value: string | null) {
  return value?.slice(0, 10) ?? null;
}

export function isDateOverdue(
  deadline: string | null,
  now = new Date(),
  timeZone = SOUTH_AFRICA_TIME_ZONE,
) {
  const deadlineKey = deadlineDateKey(deadline);
  if (!deadlineKey) return false;

  return deadlineKey < dateKeyInTimeZone(now, timeZone);
}

// Pure date-key arithmetic -- deliberately UTC-anchored (not timeZone-aware)
// since a "YYYY-MM-DD" key has no time-of-day component to convert; only
// the initial key (from dateKeyInTimeZone) needs to be timezone-correct.
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

