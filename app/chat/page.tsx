"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { learner } from "@/data/learners";
import { neueHaas } from "@/app/fonts";
import {
  MessageCircle,
  Send,
  Users,
} from "lucide-react";

type Notice = {
  text: string;
};

export default function ChatPage() {
  const [notice, setNotice] = useState("");
  const [notices, setNotices] = useState<Notice[]>([]);

  function sendNotice() {
    if (!notice.trim()) return;

    setNotices((previous) => [
      {
        text: notice,
      },
      ...previous,
    ]);

    setNotice("");
  }

  return (
    <main className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-32`}>
      <div className="max-w-md mx-auto">
        <div
          className="relative mb-6 overflow-hidden rounded-[2rem] border border-blue-100 shadow-lg"
          style={{
            height: "190px",
          }}
        >
          <Image
            src="/hero-banner.png"
            alt="Teacher Chat Banner"
            fill
            priority
            className="object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />

          <div className="relative z-10 h-full p-5 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-3">
              <Image
                src="/ad_astra_logo.png"
                alt="AD Astra Logo"
                width={58}
                height={58}
              />

              <Image
                src="/ad_astra_wordmark.png"
                alt="AD ASTRA"
                width={180}
                height={47}
                style={{
                  width: "180px",
                  height: "auto",
                }}
              />
            </div>

            <h1
              style={{
                color: "white",
                fontSize: "30px",
                fontWeight: 700,
              }}
            >
              Teacher Chats
            </h1>

            <p
              style={{
                color: "#d0d4dd",
                fontSize: "14px",
                fontWeight: 500,
                marginTop: "6px",
              }}
            >
              {learner.name} • Talk to your teachers.
            </p>
          </div>
        </div>

        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
              <MessageCircle size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Teacher Chats
              </h2>
              <p className="text-xs font-medium text-black/50">
                Read and reply to your teachers
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Link href="/chat/re-petersen">
              <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Image
                      src="/re-petersen.png"
                      alt="RE Petersen"
                      width={48}
                      height={48}
                      className="rounded-full border border-blue-100 object-cover"
                    />

                    <div>
                      <p className="text-sm font-bold text-black">
                        RE Petersen
                      </p>
                      <p className="mt-1 text-xs text-black/50">
                        Business Studies • New message
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full bg-[#FFF3E6] px-3 py-1 text-xs font-bold text-[#F97316]">
                    New
                  </span>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-black/70">
                  Remember to review Activity 16 before Friday.
                </p>
              </div>
            </Link>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
              <Users size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Message All Teachers
              </h2>
              <p className="text-xs font-medium text-black/50">
                Notify all your teachers at once
              </p>
            </div>
          </div>

          <textarea
            value={notice}
            onChange={(event) => setNotice(event.target.value)}
            placeholder="Example: I am absent today and will catch up on my work."
            className="min-h-[110px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#508DB1]"
          />

          <button
            onClick={sendNotice}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#102A43] py-3 text-sm font-semibold text-white shadow-sm"
          >
            <Send size={18} />
            Send to All Teachers
          </button>

          {notices.length > 0 && (
            <div className="mt-4 space-y-3">
              {notices.map((item, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-blue-100 bg-[#F8FBFF] p-4"
                >
                  <p className="text-xs font-bold text-[#508DB1]">
                    Sent to all teachers
                  </p>

                  <p className="mt-2 text-sm leading-relaxed text-black/75">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-100 bg-white/95 backdrop-blur">
        <div className="max-w-md mx-auto grid grid-cols-5 text-center text-sm font-semibold text-black">
          <Link href="/home">
            <div className="py-4">Home</div>
          </Link>

          <Link href="/subjects">
            <div className="py-4">Subjects</div>
          </Link>

          <Link href="/chat">
            <div className="py-4 text-[#508DB1]">Chat</div>
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