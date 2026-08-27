import { SubjectActivityPage } from "@/components/subjects/SubjectActivityPage";
import {
  getLearnerActivityDataServer,
  getLearnerSavedActivitySubmissionServer,
} from "@/lib/supabase/learnerSubjectPageData";
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

export async function SubjectActivityRoutePage({
  activityId,
  subjectKey = "business-studies",
}: {
  activityId: string;
  subjectKey?: SubjectKey;
}) {
  const subject = getSubjectConfiguration(subjectKey);

  const [activityResult, submissionResult, teacherNamesResult, accessibilityResult] =
    await Promise.allSettled([
      getLearnerActivityDataServer(activityId, subject.databaseId),
      getLearnerSavedActivitySubmissionServer(activityId, subject.databaseId),
      getSubjectTeacherNames(subject.databaseId),
      // Stage C: UI-visibility convenience only -- every
      // question-audio request is independently re-verified server-side
      // regardless of this flag (see
      // app/api/activities/[activityId]/question-audio/route.ts).
      getCurrentLearnerAccessibilityStatus(),
    ]);

  const initialActivityData =
    activityResult.status === "fulfilled" && activityResult.value.status === "success"
      ? activityResult.value.data
      : null;
  const initialActivityState =
    activityResult.status === "fulfilled"
      ? activityResult.value.status === "success"
        ? null
        : activityResult.value.status
      : "error";
  const initialSubmissionLoaded = submissionResult.status === "fulfilled";
  const initialSubmission =
    submissionResult.status === "fulfilled" ? submissionResult.value : null;
  const initialTeacherNames =
    teacherNamesResult.status === "fulfilled" ? teacherNamesResult.value : [];
  const accessibilityCapabilities =
    accessibilityResult.status === "fulfilled"
      ? accessibilityResult.value.capabilities
      : NO_ACCESSIBILITY_CAPABILITIES;

  if (activityResult.status === "rejected") {
    console.error(
      `Unable to load learner ${subject.displayName} activity bootstrap:`,
      activityResult.reason,
    );
  }

  if (submissionResult.status === "rejected") {
    console.error(
      `Unable to load learner ${subject.displayName} saved activity submission:`,
      submissionResult.reason,
    );
  }

  if (teacherNamesResult.status === "rejected") {
    console.error(
      `Unable to load learner ${subject.displayName} teacher names:`,
      teacherNamesResult.reason,
    );
  }

  if (accessibilityResult.status === "rejected") {
    console.error(
      "Unable to load learner accessibility status:",
      accessibilityResult.reason,
    );
  }

  return (
    <SubjectActivityPage
      subjectKey={subjectKey}
      initialActivityData={initialActivityData}
      initialActivityState={initialActivityState}
      initialSubmission={initialSubmission}
      initialSubmissionLoaded={initialSubmissionLoaded}
      initialTeacherNames={initialTeacherNames}
      accessibilityCapabilities={accessibilityCapabilities}
    />
  );
}
