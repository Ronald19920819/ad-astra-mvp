import Image from "next/image";
import { neueHaas } from "@/app/fonts";
import type { SubjectAnnouncementSummary } from "@/lib/supabase/subjectCommunications";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";
import { MessageSquareText } from "lucide-react";

export function TeacherAnnouncementsCard({
  announcements,
}: {
  announcements: SubjectAnnouncementSummary[];
}) {
  return (
    <div className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
          <MessageSquareText size={22} />
        </div>

        <div>
          <h2 className="text-lg font-bold text-[#102A43]">
            Teacher Announcements
          </h2>
          <p className="text-xs font-medium text-black/50">
            Updates from your active subjects
          </p>
        </div>
      </div>

      {announcements.length === 0 ? (
        <div className="flex items-center justify-center py-2">
          <div className="relative w-full max-w-[18rem] sm:max-w-[20rem]">
            <Image
              src="/home/leon-announcements-empty.png"
              alt="Teacher Announcements empty state"
              width={640}
              height={640}
              className="h-auto w-full object-contain"
              sizes="(min-width: 1024px) 18rem, (min-width: 640px) 20rem, 75vw"
              unoptimized
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((announcement) => {
            const subject =
              getSubjectConfigurationByDatabaseId(announcement.subjectId);

            return (
              <div
                key={announcement.id}
                className="rounded-2xl border border-blue-100 bg-[#F8FBFF] px-4 py-3"
              >
                <p className={`${neueHaas.className} text-sm font-semibold text-slate-900`}>
                  {announcement.message}
                </p>
                <p className="mt-2 text-xs font-medium text-slate-500">
                  {subject?.displayName ?? "Subject"}
                  {announcement.teacherName
                    ? ` · ${announcement.teacherName}`
                    : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
