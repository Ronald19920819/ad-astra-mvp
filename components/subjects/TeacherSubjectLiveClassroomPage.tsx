import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowLeft, MonitorPlay } from "lucide-react";
import { neueHaas } from "@/app/fonts";
import LiveClassChatPanel from "@/components/subjects/LiveClassChatPanel";
import LiveClassroomPlayer from "@/components/subjects/LiveClassroomPlayer";
import { authorizeTeacher } from "@/lib/supabase/teacherAuth";
import { getAuthenticatedTeacherProfile } from "@/lib/supabase/teacherProfile";
import {
  buildSubjectRoute,
  getSubjectConfiguration,
  type SubjectKey,
} from "@/lib/subjects/subjectConfig";

export const dynamic = "force-dynamic";

export async function TeacherSubjectLiveClassroomPage({
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

  let teacherProfile = null;
  let loadError = "";

  try {
    const authorization = await authorizeTeacher(subject.databaseId);
    if (!authorization.success) {
      loadError =
        authorization.status === 401
          ? "Teacher sign-in is required to open this Live Classroom."
          : "You do not have access to this Live Classroom.";
    } else {
      teacherProfile = await getAuthenticatedTeacherProfile();
      if (!teacherProfile) {
        loadError = "Unable to load this Live Classroom.";
      }
    }
  } catch (error) {
    console.error(`Unable to load ${subject.displayName} teacher Live Classroom:`, error);
    loadError = "Unable to load this Live Classroom.";
  }

  if (loadError) {
    return (
      <main
        className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-12`}
      >
        <div className="mx-auto max-w-md rounded-[2rem] border border-red-100 bg-white p-5 shadow-sm">
          <Link
            href="/teacher/subjects"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700"
          >
            <ArrowLeft size={16} /> Back to Subjects
          </Link>
          <p className="text-sm font-semibold text-red-600">{loadError}</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-12`}
      style={themeStyle}
    >
      <div className="mx-auto w-full max-w-md min-w-0 lg:max-w-6xl">
        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <Link
            href={buildSubjectRoute(subject, "teacherOverview")}
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

        <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(22rem,3fr)]">
          <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-[#102A43]">
                Live Classroom
              </h2>
              <p className="text-sm text-slate-500">
                Open the live stream and manage learner chat for this subject.
              </p>
            </div>

            <LiveClassroomPlayer
              subjectColour={subject.colourTheme.primary}
              subjectSoftBackground={subject.colourTheme.softBackground}
            />
          </section>

          <LiveClassChatPanel
            subjectId={subject.databaseId}
            subjectColour={subject.colourTheme.primary}
            subjectSoftBackground={subject.colourTheme.softBackground}
            presenceIdentity={{
              profileId: teacherProfile!.profileId,
              displayName: teacherProfile!.displayName,
              role: "teacher",
            }}
            messagePlaceholder="Send a message to the class..."
            showLearnerPresenceList
            composerVariant="teacher"
          />
        </div>
      </div>
    </main>
  );
}

export default TeacherSubjectLiveClassroomPage;
