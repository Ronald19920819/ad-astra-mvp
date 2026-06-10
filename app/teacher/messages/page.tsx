"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { neueHaas } from "@/app/fonts";
import {
  ArrowLeft,
  MessageCircle,
  Send,
  Users,
  User,
} from "lucide-react";

type Announcement = {
  text: string;
  className: string;
};

export default function TeacherMessagesPage() {
  const [announcement, setAnnouncement] = useState("");
  const [announcements, setAnnouncements] = useState<Announcement[]>([
    {
      className: "Business Studies",
      text: "Remember to complete Activity 16 before Friday.",
    },
  ]);

  function sendAnnouncement() {
    if (!announcement.trim()) return;

    setAnnouncements((previous) => [
      {
        className: "Business Studies",
        text: announcement,
      },
      ...previous,
    ]);

    setAnnouncement("");
  }

  return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] pb-32`}
    >
      <div className="mx-auto max-w-3xl">
      <div className="px-5 pt-5">
  <div
    className="relative mb-6 overflow-hidden rounded-[2rem] border border-blue-100 bg-black shadow-lg"
    style={{
      height: "190px",
      backgroundImage: "url('/hero-banner-2.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
    }}
  >
    <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />

    <div className="relative z-10 h-full p-5 flex flex-col pt-2">
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
          src="/ad_astra_wordmark_2.png"
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

      <h1 className="text-xl font-bold text-white">
        Learner Chats
      </h1>

      <p className="mt-1 text-sm font-medium text-[#d0d4dd]">
        RE Petersen • Talk to your learners.
      </p>
    </div>
  </div>
</div>

        <div className="space-y-5 px-5">

<section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
                <User size={22} />
              </div>

              <div>
                <h2 className="text-lg font-bold text-[#102A43]">
                  Learner Chats
                </h2>
                <p className="text-xs font-medium text-black/50">
                  Read and reply to individual learners
                </p>
              </div>
            </div>

            <div className="space-y-6">
                
              <Link href="/teacher/messages/danielle-coetzee">
  <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm cursor-pointer">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-bold text-black">
          Danielle Coetzee
        </p>
        <p className="mt-1 text-xs text-black/50">
          Business Studies • New message
        </p>
      </div>

      <span className="rounded-full bg-[#FFF3E6] px-3 py-1 text-xs font-bold text-[#F97316]">
        New
      </span>
    </div>

    <p className="mt-3 text-sm leading-relaxed text-black/70">
      Sir, can you please explain the case study question again?
    </p>
  </div>
</Link>

              <div className="mt-5 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-black">
                      Bastian Meyer
                    </p>
                    <p className="mt-1 text-xs text-black/50">
                      History • Yesterday
                    </p>
                  </div>

                  <span className="rounded-full bg-[#EEF7FF] px-3 py-1 text-xs font-bold text-[#508DB1]">
                    Read
                  </span>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-black/70">
                  I uploaded my activity late, please check if it came through.
                </p>
              </div>
            </div>
          </section>
        </div>

          <section className="mt-8 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
                <Users size={22} />
              </div>

              <div>
                <h2 className="text-lg font-bold text-[#102A43]">
                  Announce to Class
                </h2>
                <p className="text-xs font-medium text-black/50">
                  Send one message to all learners in a class
                </p>
              </div>
            </div>

            <textarea
              value={announcement}
              onChange={(event) => setAnnouncement(event.target.value)}
              placeholder="Write an announcement for Business Studies..."
              className="min-h-[110px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#508DB1]"
            />

            <button
              onClick={sendAnnouncement}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#102A43] py-3 text-sm font-semibold text-white shadow-sm"
            >
              <Send size={18} />
              Send to Whole Class
            </button>
          </section>
</div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-100 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm  text-black">
          <Link href="/teacher">
            <div className="py-4">Home</div>
          </Link>

          <Link href="/teacher/subjects">
            <div className="py-4">Subjects</div>
          </Link>

          <Link href="/teacher/messages">
            <div className="py-4 text-[#508DB1]">Messages</div>
          </Link>



          <Link href="/teacher/reports">
            <div className="py-4">Reports</div>
          </Link>

          <Link href="/teacher/profile">
            <div className="py-4">Profile</div>
          </Link>
        </div>
      </nav>
    </main>
  );
}