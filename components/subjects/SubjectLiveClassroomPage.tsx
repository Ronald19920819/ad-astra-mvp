import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowLeft, MonitorPlay, Radio } from "lucide-react";
import { neueHaas } from "@/app/fonts";
import LiveClassChatPanel from "@/components/subjects/LiveClassChatPanel";
import LiveClassroomPlayer from "@/components/subjects/LiveClassroomPlayer";
import { getAuthenticatedLearnerProfile } from "@/lib/supabase/learnerProfile";
import { verifyLearnerSubjectAccessForProfile } from "@/lib/supabase/subjectAccess";
import {
  buildSubjectRoute,
  getSubjectConfiguration,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";

export const dynamic = "force-dynamic";

export async function SubjectLiveClassroomPage({
  subjectKey = "business-studies",
}: {
  subjectKey?: SubjectKey;
}) {
  const subject = getSubjectConfiguration(subjectKey);
  const themeStyle = {
    "--subject-primary": subject.colourTheme.primary,
    "--subject-soft": subject.colourTheme.softBackground,
    "--subject-border": subject.colourTheme.border,
  } as CSSProperties;

  let learnerProfile = null;
  let loadError = "";

  try {
    learnerProfile = await getAuthenticatedLearnerProfile();
    if (!learnerProfile) {
      loadError = "Unable to load this Live Classroom.";
    } else {
      const access = verifyLearnerSubjectAccessForProfile(
        learnerProfile,
        subject.databaseId,
      );

      if (!access.allowed) {
        loadError = "You do not have access to this Live Classroom.";
      }
    }
  } catch (error) {
    console.error(`Unable to load ${subject.displayName} Live Classroom:`, error);
    loadError = "Unable to load this Live Classroom.";
  }

  if (loadError) {
    return (
      <main
        className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-12`}
      >
        <div className="mx-auto w-full max-w-md rounded-[2rem] border border-red-100 bg-white p-5 shadow-sm md:max-w-4xl">
          <Link
            href="/subjects"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700"
          >
            <ArrowLeft size={16} /> Back to Subjects
          </Link>
          <p className="text-sm font-semibold text-red-600">{loadError}</p>
        </div>
      </main>
    );
  }

  const activeLearnerProfile = learnerProfile;

  return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-12`}
      style={themeStyle}
    >
      <div className="mx-auto w-full max-w-md min-w-0 md:max-w-4xl lg:max-w-6xl">
        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm lg:mb-8">
          <Link
            href={buildSubjectRoute(subject, "learnerDashboard")}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--subject-primary)]"
          >
            <ArrowLeft size={16} /> Back to Subject
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[var(--subject-soft)] p-3 text-[var(--subject-primary)]">
              <MonitorPlay size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-[#102A43]">
                Live Classroom
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {subject.displayName}
              </p>
            </div>
          </div>
        </section>

        <div className="mb-5 grid grid-cols-1 gap-5 md:gap-6 lg:mb-8 lg:grid-cols-[minmax(0,7fr)_minmax(20rem,3fr)] lg:items-start lg:gap-6">
          <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-[#102A43]">
                Live Classroom
              </h2>
              <p className="text-sm text-slate-500">
                Join your teacher&apos;s live lesson when it is in session.
              </p>
            </div>

            <LiveClassroomPlayer
              subjectColour={subject.colourTheme.primary}
              subjectSoftBackground={subject.colourTheme.softBackground}
              requireExplicitAudioJoin
              logContext={{ role: "learner", subjectKey }}
            />
          </section>

          <LiveClassChatPanel
            subjectId={subject.databaseId}
            subjectColour={subject.colourTheme.primary}
            subjectSoftBackground={subject.colourTheme.softBackground}
            presenceIdentity={{
              profileId: activeLearnerProfile!.profileId,
              displayName: activeLearnerProfile!.displayName,
              role: "learner",
            }}
          />
        </div>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm lg:mb-8">
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-2xl bg-[var(--subject-soft)] p-3 text-[var(--subject-primary)]">
              <Radio size={20} />
            </div>
            <h2 className="text-lg font-bold text-[#102A43]">
              Today&apos;s Live Lesson
            </h2>
          </div>
          <p className="text-sm text-slate-600">
            No live lesson is currently in progress.
          </p>
        </section>

        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#102A43]">
            About Live Classes
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li>Join a few minutes before the lesson begins.</li>
            <li>Keep the Live Classroom page open during the lesson.</li>
            <li>
              When live chat is added, you will be able to ask questions from
              this page.
            </li>
            <li>
              If you miss the lesson, the recording may later appear in
              Classroom.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}

export default SubjectLiveClassroomPage;
