import { SubjectActivities } from "@/components/subjects/SubjectActivities";
import { getLearnerPublishedActivitiesServer } from "@/lib/supabase/learnerSubjectPageData";
import { getSubjectTeacherNames } from "@/lib/supabase/subjectTeacherNames";
import { getSubjectConfiguration, type SubjectKey } from "@/lib/subjects/subjectConfig";

export async function SubjectActivitiesPage({
  subjectKey = "business-studies",
}: {
  subjectKey?: SubjectKey;
}) {
  const subject = getSubjectConfiguration(subjectKey);
  let initialActivities = undefined;
  let initialLoadError = undefined;
  let initialTeacherNames: string[] = [];

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

  try {
    initialTeacherNames = await getSubjectTeacherNames(subject.databaseId);
  } catch (error) {
    console.error(
      `Unable to load learner ${subject.displayName} teacher names:`,
      error,
    );
  }

  return (
    <SubjectActivities
      subjectKey={subjectKey}
      initialActivities={initialActivities}
      initialLoadError={initialLoadError}
      initialTeacherNames={initialTeacherNames}
    />
  );
}
