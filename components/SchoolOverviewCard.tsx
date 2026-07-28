import Link from "next/link";
import { neueHaas } from "@/app/fonts";
import { GraduationCap } from "lucide-react";

export default function SchoolOverviewCard() {
  return (
    <Link href="/subjects" className="mb-5 block">
      <div className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.2rem] bg-[#EEF7FF]">
            <GraduationCap size={30} color="#508DB1" strokeWidth={2.2} />
          </div>

          <div className="flex-1">
            <h2
              className={neueHaas.className}
              style={{
                color: "#0f172a",
                fontSize: "20px",
                fontWeight: 700,
              }}
            >
              School
            </h2>

            <div className="mt-3 space-y-2">
              <p className={`${neueHaas.className} text-sm text-slate-700`}>
                Open your approved subjects to view current lessons, activities,
                and progress.
              </p>
            </div>

            <div
              className={`${neueHaas.className} mt-4 rounded-2xl py-3 text-center text-sm font-bold`}
              style={{
                backgroundColor: "#102A43",
                color: "#ffffff",
              }}
            >
              Open Subjects
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
