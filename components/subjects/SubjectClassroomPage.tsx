import { SubjectClassroom } from "@/components/subjects/SubjectClassroom";
import { getLearnerPublishedLessonsWithCompletionServer } from "@/lib/supabase/learnerSubjectPageData";
import { getSubjectTeacherNames } from "@/lib/supabase/subjectTeacherNames";
import { getSubjectConfiguration, type SubjectKey } from "@/lib/subjects/subjectConfig";

export async function SubjectClassroomPage({
  subjectKey = "business-studies",
}: {
  subjectKey?: SubjectKey;
}) {
  const subject = getSubjectConfiguration(subjectKey);
  let initialLessons = undefined;
  let initialLoadError = undefined;
  let initialTeacherNames: string[] = [];

  try {
    initialLessons = await getLearnerPublishedLessonsWithCompletionServer(
      subject.databaseId,
    );
  } catch (error) {
    console.error(`Failed to load learner ${subject.displayName} classroom:`, error);
    initialLoadError = "Unable to load lessons. Please try again.";
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
    <SubjectClassroom
      subjectKey={subjectKey}
      initialLessons={initialLessons}
      initialLoadError={initialLoadError}
      initialTeacherNames={initialTeacherNames}
    />
  );
}
