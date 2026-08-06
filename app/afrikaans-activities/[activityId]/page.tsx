import { SubjectActivityRoutePage } from "@/components/subjects/SubjectActivityRoutePage";
import { resolveSubjectKeyFromSearchParams } from "@/lib/subjects/subjectPage";

export default async function AfrikaansActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ activityId: string }>;
  searchParams?: Promise<{ subject?: string | string[] }>;
}) {
  const { activityId } = await params;
  const subjectKey = resolveSubjectKeyFromSearchParams(
    "afrikaans",
    await searchParams,
  );

  return <SubjectActivityRoutePage activityId={activityId} subjectKey={subjectKey} />;
}
