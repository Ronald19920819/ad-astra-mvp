import { SubjectLessonPage } from "@/components/subjects/SubjectLessonPage";
import { getLearnerLessonDataServer } from "@/lib/supabase/learnerSubjectPageData";
import { getSubjectTeacherNames } from "@/lib/supabase/subjectTeacherNames";
import { getSubjectConfiguration, type SubjectKey } from "@/lib/subjects/subjectConfig";
import {
  getCurrentLearnerAccessibilityStatus,
  type LearnerAccessibilityCapabilities,
} from "@/lib/supabase/learnerAccessibilityStatus";

const NO_ACCESSIBILITY_CAPABILITIES: LearnerAccessibilityCapabilities = {
  questionAudio: false,
  recordAnswer: false,
};

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
  let accessibilityCapabilities: LearnerAccessibilityCapabilities = NO_ACCESSIBILITY_CAPABILITIES;

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

  // Stage C/E: this is a UI-visibility convenience only -- every
  // quiz-question-audio request is independently re-verified server-side
  // regardless of this flag (see
  // app/api/lessons/[lessonId]/quiz-question-audio/route.ts). Failing
  // closed (no capabilities) on any error, never surfacing accessibility
  // state to the learner as an error condition.
  try {
    ({ capabilities: accessibilityCapabilities } = await getCurrentLearnerAccessibilityStatus());
  } catch (error) {
    console.error("Unable to load learner accessibility status:", error);
  }

  return (
    <SubjectLessonPage
      subjectKey={subjectKey}
      initialLessonData={initialLessonData}
      initialLoadError={initialLoadError}
      initialTeacherNames={initialTeacherNames}
      accessibilityCapabilities={accessibilityCapabilities}
    />
  );
}
