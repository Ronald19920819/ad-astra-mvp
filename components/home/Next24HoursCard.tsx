import Link from "next/link";
import { neueHaas } from "@/app/fonts";
import type { LearnerNext24HoursItem } from "@/lib/supabase/subjectCommunications";
import { Bell, BookOpen, ClipboardList } from "lucide-react";

function iconForItem(kind: LearnerNext24HoursItem["kind"]) {
  if (kind === "lesson") return BookOpen;
  return ClipboardList;
}

export function Next24HoursCard({
  items,
}: {
  items: LearnerNext24HoursItem[];
}) {
  return (
    <div className="mb-5 overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-sm">
      <div className="flex items-center gap-4 border-b border-blue-100 px-5 py-4">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF2FF]">
          <Bell size={24} color="#508DB1" strokeWidth={2.2} />
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#102A43] text-[11px] font-bold text-white">
            {items.length}
          </span>
        </div>

        <div>
          <h2
            className={neueHaas.className}
            style={{
              color: "#0f172a",
              fontSize: "18px",
              fontWeight: 700,
            }}
          >
            Message Board
          </h2>

          <p
            className={neueHaas.className}
            style={{
              color: "#334155",
              fontSize: "12px",
              fontWeight: 500,
              marginTop: "2px",
            }}
          >
            Next 24 Hours
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-4 text-sm font-medium text-slate-500">
          Nothing scheduled during the next 24 hours.
        </p>
      ) : (
        <div className="divide-y divide-blue-50">
          {items.map((item) => {
            const Icon = iconForItem(item.kind);

            return (
              <Link key={`${item.kind}-${item.id}`} href={item.href} className="block">
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF7FF]">
                    <Icon size={24} color="#508DB1" strokeWidth={2.2} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={neueHaas.className}
                      style={{
                        color: "#0f172a",
                        fontSize: "16px",
                        fontWeight: 700,
                      }}
                    >
                      {item.title}
                    </p>

                    <p
                      className={neueHaas.className}
                      style={{
                        color: "#334155",
                        fontSize: "12px",
                        fontWeight: 500,
                        marginTop: "2px",
                      }}
                    >
                      {item.subjectName}
                    </p>
                  </div>

                  <p
                    className={`${neueHaas.className} text-right`}
                    style={{
                      color: "#2563eb",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    {item.scheduleLabel}
                  </p>

                  <span className="text-3xl font-light text-[#0f172a]">›</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
