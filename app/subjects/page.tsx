import Image from "next/image";
import Link from "next/link";
import { learner } from "@/data/learners";
import { neueHaas } from "@/app/fonts";
import {
  BarChart3,
  BookOpen,
  NotebookPen,
  ScrollText,
} from "lucide-react";

function getSubjectStyle(name: string) {
  if (name.toLowerCase().includes("business")) {
    return { icon: BarChart3, color: "#F97316", bg: "#FFF3E6" };
  }

  if (name.toLowerCase().includes("english")) {
    return { icon: BookOpen, color: "#2563EB", bg: "#EEF5FF" };
  }

  if (name.toLowerCase().includes("afrikaans")) {
    return { icon: BookOpen, color: "#eb2525", bg: "#EEF7FF" };
  }

  if (name.toLowerCase().includes("history")) {
    return { icon: ScrollText, color: "#3AAA35", bg: "#EEFBEA" };
  }

  return { icon: "✨", color: "#508db1", bg: "#EEF7FF" };
}

export default function SubjectsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-48">
      <div className="max-w-md mx-auto">
        <div
          className="relative mb-6 overflow-hidden rounded-[2rem] border border-blue-100 bg-black shadow-lg"
          style={{
            height: "190px",
            backgroundImage: "url('/hero-banner.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />

          <div className="relative z-10 h-full p-5 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-3">
              <Image
                src="/ad_astra_logo.png"
                alt="AD Astra Logo"
                width={58}
                height={58}
                unoptimized
                className="bg-transparent"
              />

              <Image
                src="/ad_astra_wordmark.png"
                alt="AD ASTRA"
                width={180}
                height={47}
                priority
                style={{
                  width: "180px",
                  height: "auto",
                }}
              />
            </div>

            <h1
              className={`${neueHaas.className}`}
              style={{
                color: "white",
                fontSize: "20px",
                fontWeight: 700,
                lineHeight: 1.1,
              }}
            >
              Subjects
            </h1>

            <p
              className={`${neueHaas.className}`}
              style={{
                color: "#d0d4dd",
                fontSize: "14px",
                fontWeight: 500,
                marginTop: "6px",
              }}
            >
              {learner.name} • Choose a subject
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {learner.subjects.map((subject) => {
            const style = getSubjectStyle(subject.name);
            const Icon = style.icon;

            const cardContent = (
              <div className="flex items-center gap-4 rounded-[2rem] border border-blue-100 bg-white px-4 py-4 shadow-sm">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.2rem] text-3xl shadow-md"
                  style={{
                    backgroundColor: style.color,
                    color: "white",
                  }}
                >
                  <Icon
                    size={32}
                    color="white"
                    strokeWidth={2.2}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <h2
                    className={`${neueHaas.className}`}
                    style={{
                      color: "#0f172a",
                      fontSize: "18px",
                      fontWeight: 700,
                      lineHeight: 1.1,
                    }}
                  >
                    {subject.name}
                  </h2>

                  <p
                    className={`${neueHaas.className}`}
                    style={{
                      color: "#0f172a",
                      fontSize: "12px",
                      fontWeight: 500,
                      marginTop: "6px",
                    }}
                  >
                    <strong>Latest Mark:</strong>{" "}
                    <span style={{ color: style.color, fontWeight: 700 }}>
                      {subject.latestMark}%
                    </span>
                  </p>

                  <p
                    className={`${neueHaas.className}`}
                    style={{
                      color: "#0f172a",
                      fontSize: "12px",
                      fontWeight: 500,
                      marginTop: "4px",
                    }}
                  >
                    <strong>Current Topic:</strong> {subject.currentTopic}
                  </p>

                  <p
                    className={`${neueHaas.className}`}
                    style={{
                      color: "#0f172a",
                      fontSize: "12px",
                      fontWeight: 500,
                      marginTop: "4px",
                    }}
                  >
                    <strong>Next Activity:</strong> {subject.nextActivity}
                  </p>
                </div>

                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(${style.color} ${
                      subject.latestMark * 3.6
                    }deg, #E5E7EB 0deg)`,
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
                      {subject.latestMark}%
                    </span>
                  </div>
                </div>

                <span className="text-3xl font-light text-[#0f172a]">›</span>
              </div>
            );

            if (subject.slug === "business-studies") {
              return (
                <Link key={subject.slug} href="/business-studies-dashboard" className="block">
                  {cardContent}
                </Link>
              );
            }

            if (subject.slug === "english") {
              return (
                <Link key={subject.slug} href="/english-dashboard" className="block">
                  {cardContent}
                </Link>
              );
            }

            if (subject.slug === "afrikaans") {
              return (
                <Link key={subject.slug} href="/afrikaans-dashboard" className="block">
                  {cardContent}
                </Link>
              );
            }

            if (subject.slug === "history") {
              return (
                <Link key={subject.slug} href="/history-dashboard" className="block">
                  {cardContent}
                </Link>
              );
            }

            return <div key={subject.slug}>{cardContent}</div>;
          })}
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-blue-100 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="max-w-md mx-auto grid grid-cols-5 text-center text-sm font-semibold text-black">
          <Link href="/home">
            <div className="py-4">Home</div>
          </Link>

          <Link href="/subjects">
            <div className="py-4">Subjects</div>
          </Link>

          <Link href="/chat">
            <div className="py-4">Chat</div>
          </Link>

          <Link href="/schedule">
            <div className="py-4">Schedule</div>
          </Link>

          <Link href="/profile">
            <div className="py-4">Profile</div>
          </Link>
        </div>
      </nav>
    </main>
  );
}