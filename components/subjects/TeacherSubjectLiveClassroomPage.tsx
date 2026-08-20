import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowLeft, MonitorPlay } from "lucide-react";
import { neueHaas } from "@/app/fonts";
import LiveClassroomWorkspace from "@/components/subjects/LiveClassroomWorkspace";
import { getMediaProviderForSubject } from "@/lib/liveClass/mediaProvider";
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
  const mediaProvider = getMediaProviderForSubject(subjectKey);

  // TEMPORARY DIAGNOSTIC (Stage 3 pilot activation): server-side only,
  // development-only, never rendered in the learner-facing UI -- lets a
  // developer confirm which media provider a given subject resolved to
  // without needing to expose that detail to learners.
  if (process.env.NODE_ENV === "development") {
    console.info("[Live Classroom] media provider:", {
      mediaProvider,
      subjectKey,
      subjectId: subject.databaseId,
    });
  }

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

        <LiveClassroomWorkspace
          subjectKey={subjectKey}
          subjectDatabaseId={subject.databaseId}
          subjectColour={subject.colourTheme.primary}
          subjectSoftBackground={subject.colourTheme.softBackground}
          role="teacher"
          presenceIdentity={{
            profileId: teacherProfile!.profileId,
            displayName: teacherProfile!.displayName,
            role: "teacher",
          }}
          videoCardSubtitle="Open the live stream and manage learner chat for this subject."
          messagePlaceholder="Send a message to the class..."
          composerVariant="teacher"
          mediaProvider={mediaProvider}
        />
      </div>
    </main>
  );
}

export default TeacherSubjectLiveClassroomPage;
