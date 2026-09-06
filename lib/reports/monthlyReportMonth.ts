// Pure helpers for the Monthly Report's canonical month representation:
// always the first day of the reporting month (e.g. "2026-08-01"), never
// a free-text label. The label is a presentation concern only, derived
// from the same stored value -- never stored itself.

const MONTH_INPUT_PATTERN = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/;

// Accepts "YYYY-MM" or "YYYY-MM-DD" (any day-of-month) and normalises to
// the first day of that month. Throws on anything else -- a malformed
// month must never silently become some other date.
export function normalizeReportMonth(value: string): string {
  const match = MONTH_INPUT_PATTERN.exec(value.trim());
  if (!match) {
    throw new RangeError(`"${value}" is not a valid reporting month.`);
  }

  const [, year, month] = match;
  const monthNumber = Number(month);
  if (monthNumber < 1 || monthNumber > 12) {
    throw new RangeError(`"${value}" is not a valid reporting month.`);
  }

  return `${year}-${month}-01`;
}

// "2026-08-01" -> "August 2026"
export function formatReportMonthLabel(reportMonth: string): string {
  const normalized = normalizeReportMonth(reportMonth);
  const date = new Date(`${normalized}T00:00:00Z`);
  return date.toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
