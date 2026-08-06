import { SubjectActivities } from "@/components/subjects/SubjectActivities";
import { getLearnerPublishedActivitiesServer } from "@/lib/supabase/learnerSubjectPageData";
import { getSubjectConfiguration, type SubjectKey } from "@/lib/subjects/subjectConfig";

export async function SubjectActivitiesPage({
  subjectKey = "business-studies",
}: {
  subjectKey?: SubjectKey;
}) {
  const subject = getSubjectConfiguration(subjectKey);
  let initialActivities = undefined;
  let initialLoadError = undefined;

  try {
    initialActivities = await getLearnerPublishedActivitiesServer(
      subject.databaseId,
    );
  } catch (error) {
    console.error(
      `Unable to load learner ${subject.displayName} activities:`,
      error,
    );
    initialLoadError = "Unable to load activities";
  }

  return (
    <SubjectActivities
      subjectKey={subjectKey}
      initialActivities={initialActivities}
      initialLoadError={initialLoadError}
    />
  );
}
