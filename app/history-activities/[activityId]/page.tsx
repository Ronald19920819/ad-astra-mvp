import { SubjectActivityRoutePage } from "@/components/subjects/SubjectActivityRoutePage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export default async function HistoryActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ activityId: string }>;
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const { activityId } = await params;
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "history",
    await searchParams,
  );

  return <SubjectActivityRoutePage activityId={activityId} subjectKey={subjectKey} />;
}
