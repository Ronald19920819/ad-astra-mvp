import { SubjectLessonPage } from "@/components/subjects/SubjectLessonPage";
import { getLearnerLessonDataServer } from "@/lib/supabase/learnerSubjectPageData";
import { getSubjectTeacherNames } from "@/lib/supabase/subjectTeacherNames";
import { getSubjectConfiguration, type SubjectKey } from "@/lib/subjects/subjectConfig";

export async function SubjectLessonRoutePage({
  lessonId,
  subjectKey = "business-studies",
}: {
  lessonId: string;
  subjectKey?: SubjectKey;
}) {
  const subject = getSubjectConfiguration(subjectKey);
  let initialLessonData = undefined;
  let initialLoadError = undefined;
  let initialTeacherNames: string[] = [];

  try {
    initialLessonData = await getLearnerLessonDataServer(
      lessonId,
      subject.databaseId,
    );
  } catch (error) {
    console.error(`Unable to load learner ${subject.displayName} lesson:`, error);
    initialLoadError = "We could not load this lesson. Please try again.";
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
    <SubjectLessonPage
      subjectKey={subjectKey}
      initialLessonData={initialLessonData}
      initialLoadError={initialLoadError}
      initialTeacherNames={initialTeacherNames}
    />
  );
}
