import { SubjectActivityPage } from "@/components/subjects/SubjectActivityPage";
import {
  getLearnerActivityDataServer,
  getLearnerSavedActivitySubmissionServer,
} from "@/lib/supabase/learnerSubjectPageData";
import { getSubjectTeacherNames } from "@/lib/supabase/subjectTeacherNames";
import { getSubjectConfiguration, type SubjectKey } from "@/lib/subjects/subjectConfig";

export async function SubjectActivityRoutePage({
  activityId,
  subjectKey = "business-studies",
}: {
  activityId: string;
  subjectKey?: SubjectKey;
}) {
  const subject = getSubjectConfiguration(subjectKey);

  const [activityResult, submissionResult, teacherNamesResult] =
    await Promise.allSettled([
      getLearnerActivityDataServer(activityId, subject.databaseId),
      getLearnerSavedActivitySubmissionServer(activityId, subject.databaseId),
      getSubjectTeacherNames(subject.databaseId),
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

  return (
    <SubjectActivityPage
      subjectKey={subjectKey}
      initialActivityData={initialActivityData}
      initialActivityState={initialActivityState}
      initialSubmission={initialSubmission}
      initialSubmissionLoaded={initialSubmissionLoaded}
      initialTeacherNames={initialTeacherNames}
    />
  );
}
