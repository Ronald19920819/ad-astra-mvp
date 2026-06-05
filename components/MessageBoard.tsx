import { neueHaas } from "@/app/fonts";

export default function MessageBoard() {
  return (
    <div className="mb-5 overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-sm">
      <div className="flex items-center gap-4 border-b border-blue-100 px-5 py-4">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF2FF] text-2xl">
          🔔
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#F97316] text-[11px] font-bold text-white">
            2
          </span>
        </div>

        <div>
          <h2
            className={`${neueHaas.className}`}
            style={{
              color: "#0f172a",
              fontSize: "18px",
              fontWeight: 700,
            }}
          >
            Message Board
          </h2>

          <p
            className={`${neueHaas.className}`}
            style={{
              color: "#334155",
              fontSize: "12px",
              fontWeight: 500,
              marginTop: "2px",
            }}
          >
            Here&apos;s what&apos;s coming up within the next 24 hours.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF7FF] text-2xl">
          📄
        </div>

        <div className="flex-1">
          <p
            className={`${neueHaas.className}`}
            style={{
              color: "#0f172a",
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            Activity 7
          </p>

          <p
            className={`${neueHaas.className}`}
            style={{
              color: "#334155",
              fontSize: "12px",
              fontWeight: 500,
              marginTop: "2px",
            }}
          >
            Business Studies
          </p>
        </div>

        <p
          className={`${neueHaas.className}`}
          style={{
            color: "#2563eb",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          Due this Friday
        </p>

        <span className="text-3xl font-light text-[#0f172a]">›</span>
      </div>
    </div>
  );
}