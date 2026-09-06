import type {
  MonthlyReportActivityEntry,
  MonthlyReportLessonEntry,
} from "@/lib/reports/monthlyReportTypes";

// Pure curriculum-sequence ordering for the Monthly Report's lesson/
// activity lists. The single shared place this is applied is
// lib/reports/monthlyReportEngine.ts, which both the teacher's "browse
// everything" catalog view and the final scoped preview call go through --
// fixing it here fixes both UI list rendering and the preview at once,
// with no client-side sorting needed. Sorting the lessons/activities
// arrays never changes any aggregate calculation (sums, counts, filters
// are all order-independent), so this cannot affect academic/engagement/
// evidence/badge results.

// Dotted lesson-number comparison, numeric per segment -- "3.10" must
// sort after "3.9", never lexically between "3.1" and "3.2".
export function compareLessonNumbers(a: string, b: string): number {
  const segmentsA = a.split(".");
  const segmentsB = b.split(".");
  const length = Math.max(segmentsA.length, segmentsB.length);

  for (let index = 0; index < length; index += 1) {
    const segmentA = segmentsA[index] ?? "";
    const segmentB = segmentsB[index] ?? "";
    const numberA = Number(segmentA);
    const numberB = Number(segmentB);

    if (segmentA !== "" && segmentB !== "" && !Number.isNaN(numberA) && !Number.isNaN(numberB)) {
      if (numberA !== numberB) return numberA - numberB;
      continue;
    }

    if (segmentA !== segmentB) return segmentA.localeCompare(segmentB);
  }

  return 0;
}

// Never sorts by created/updated/due date, status, or submission state --
// ascending curriculum sequence only. A shared lesson_number (should not
// occur in practice) falls back to the lesson's own id for a stable,
// deterministic order rather than leaving the tie unresolved.
export function sortLessonEntriesByCurriculumOrder<
  T extends Pick<MonthlyReportLessonEntry, "lessonNumber" | "lessonId">,
>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => {
    const primary = compareLessonNumbers(a.lessonNumber, b.lessonNumber);
    if (primary !== 0) return primary;
    return a.lessonId.localeCompare(b.lessonId);
  });
}

// Activities sort by their LINKED LESSON's number, never their own due
// date/submission/status. A shared lesson_number falls back to the
// activity's own id for a stable order.
export function sortActivityEntriesByCurriculumOrder<
  T extends Pick<MonthlyReportActivityEntry, "lessonNumber" | "activityId">,
>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => {
    const primary = compareLessonNumbers(a.lessonNumber, b.lessonNumber);
    if (primary !== 0) return primary;
    return a.activityId.localeCompare(b.activityId);
  });
}
