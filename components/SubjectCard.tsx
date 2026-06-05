import { neueHaas } from "@/app/fonts";

type SubjectCardProps = {
  name: string;
  latestMark: number;
  focusArea: string;
  currentTopic: string;
};

function getSubjectStyle(name: string) {
  if (name.toLowerCase().includes("business")) {
    return {
      icon: "📊",
      color: "#F97316",
      bg: "#FFF3E6",
    };
  }

  if (name.toLowerCase().includes("english")) {
    return {
      icon: "📖",
      color: "#2563EB",
      bg: "#EEF5FF",
    };
  }

  if (name.toLowerCase().includes("history")) {
    return {
      icon: "🏛️",
      color: "#3AAA35",
      bg: "#EEFBEA",
    };
  }

  return {
    icon: "✨",
    color: "#508db1",
    bg: "#EEF7FF",
  };
}

export default function SubjectCard({
  name,
  latestMark,
  focusArea,
  currentTopic,
}: SubjectCardProps) {
  const style = getSubjectStyle(name);

  return (
    <div className="flex items-center gap-4 rounded-[2rem] border border-blue-100 bg-white px-4 py-4 shadow-sm">
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.2rem] text-3xl shadow-md"
        style={{
          backgroundColor: style.color,
          color: "white",
        }}
      >
        {style.icon}
      </div>

      <div className="min-w-0 flex-1">
        <h3
          className={`${neueHaas.className}`}
          style={{
            color: "#0f172a",
            fontSize: "18px",
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          {name}
        </h3>

        <p className={`${neueHaas.className} mt-1 text-xs`} style={{ color: "#0f172a" }}>
          <strong>Latest Mark:</strong>{" "}
          <span style={{ color: style.color, fontWeight: 700 }}>{latestMark}%</span>
        </p>

        <p className={`${neueHaas.className} mt-1 text-xs`} style={{ color: "#0f172a" }}>
          <strong>Focus Area:</strong> {focusArea}
        </p>

        <p className={`${neueHaas.className} mt-1 text-xs`} style={{ color: "#0f172a" }}>
          <strong>Next Step:</strong> Revise {currentTopic}
        </p>
      </div>

      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(${style.color} ${latestMark * 3.6}deg, #E5E7EB 0deg)`,
        }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
          <span
            className={`${neueHaas.className}`}
            style={{
              color: "#0f172a",
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            {latestMark}%
          </span>
        </div>
      </div>

      <span className="text-3xl font-light text-[#0f172a]">›</span>
    </div>
  );
}