import Link from "next/link";
import { AuthenticatedLearnerName } from "@/components/learners/AuthenticatedLearnerName";
import { neueHaas } from "@/app/fonts";
import { ArrowLeft } from "lucide-react";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const rows = [
  { time: "08:00 - 08:30", subjects: ["Business", "English", "Afrikaans", "History", "Business"] },
  { time: "08:30 - 09:00", subjects: ["Business", "English", "Afrikaans", "History", "Business"] },
  { time: "09:00 - 09:30", subjects: ["English", "Business", "History", "Afrikaans", "English"] },
  { time: "09:30 - 10:00", subjects: ["English", "Business", "History", "Afrikaans", "English"] },
  { time: "10:00 - 10:30", break: "First Break" },
  { time: "10:30 - 11:00", subjects: ["Afrikaans", "History", "Business", "English", "History"] },
  { time: "11:00 - 11:30", subjects: ["Afrikaans", "History", "Business", "English", "History"] },
  { time: "11:30 - 12:00", subjects: ["History", "Afrikaans", "English", "Business", "Afrikaans"] },
  { time: "12:00 - 12:30", subjects: ["History", "Afrikaans", "English", "Business", "Afrikaans"] },
  { time: "12:30 - 13:00", break: "Second Break" },
  { time: "13:00 - 13:30", subjects: ["Business", "English", "History", "Afrikaans", "English"] },
  { time: "13:30 - 14:00", subjects: ["Business", "English", "History", "Afrikaans", "English"] },
  { time: "14:00 - 14:30", subjects: ["Study", "Study", "Study", "Study", "Study"] },
];

export default function TimetablePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] pb-32">
      <div className="sticky top-0 z-50 bg-[#102A43] px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Link href="/schedule">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
              <ArrowLeft size={24} color="white" strokeWidth={2.2} />
            </div>
          </Link>

          <div>
            <h1 className={`${neueHaas.className} text-lg font-bold text-white`}>
              <AuthenticatedLearnerName />
            </h1>
            <p className={`${neueHaas.className} text-xs font-medium text-[#d0d4dd]`}>
              Timetable
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl p-5">
        <div className="overflow-x-auto rounded-[2rem] border border-blue-100 bg-white shadow-sm">
          <table className="min-w-[760px] w-full border-collapse">
            <thead>
              <tr className="bg-[#EEF7FF]">
                <th className={`${neueHaas.className} border-b border-blue-100 px-4 py-3 text-left text-xs font-bold text-[#0f172a]`}>
                  Time
                </th>

                {days.map((day) => (
                  <th
                    key={day}
                    className={`${neueHaas.className} border-b border-blue-100 px-4 py-3 text-left text-xs font-bold text-[#0f172a]`}
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.time}>
                  <td className={`${neueHaas.className} border-b border-blue-50 px-4 py-3 text-xs font-bold text-slate-600`}>
                    {row.time}
                  </td>

                  {"break" in row ? (
                    <td
                      colSpan={5}
                      className={`${neueHaas.className} border-b border-blue-50 bg-[#FFF8E6] px-4 py-3 text-center text-xs font-bold text-[#D9A106]`}
                    >
                      {row.break}
                    </td>
                  ) : (
                    row.subjects.map((subject, index) => (
                      <td
                        key={`${row.time}-${index}`}
                        className={`${neueHaas.className} border-b border-blue-50 px-4 py-3 text-sm font-semibold text-[#0f172a]`}
                      >
                        {subject}
                      </td>
                    ))
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-blue-100 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="max-w-md mx-auto grid grid-cols-5 text-center text-sm font-semibold text-black">
          <Link href="/home"><div className="py-4">Home</div></Link>
          <Link href="/subjects"><div className="py-4">Subjects</div></Link>
          <Link href="/chat"><div className="py-4">Chat</div></Link>
          <Link href="/schedule"><div className="py-4">Schedule</div></Link>
          <Link href="/profile"><div className="py-4">Profile</div></Link>
        </div>
      </nav>
    </main>
  );
}
