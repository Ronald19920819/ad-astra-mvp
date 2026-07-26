export async function deleteDraftLesson(subjectId: string, lessonId: string) {
  const response = await fetch(
    `/api/teacher/business-studies/lessons/${lessonId}?scope=draft&subjectId=${encodeURIComponent(subjectId)}`,
    { method: "DELETE" },
  );
  const result = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(result?.error || "The draft lesson could not be deleted.");
  }
}
