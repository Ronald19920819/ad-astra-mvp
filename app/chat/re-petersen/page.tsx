"use client";

import { Shadows_Into_Light } from "next/font/google";
import Image from "next/image";
import { useState } from "react";
import { learner } from "@/data/learners";
import { neueHaas } from "@/app/fonts";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const ShadowsIntoLight = Shadows_Into_Light({
  weight: "400",
  subsets: ["latin"],
});

type ChatMessage = {
  role: "learner" | "teacher";
  text: string;
};

export default function TeacherRonaldChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "teacher",
      text: "Hi Danielle, remember to review Activity 16 before Friday. Let me know if you need help with the case study questions.",
    },
  ]);

  function sendMessage() {
    if (!message.trim()) return;

    const learnerMessage = message;

    setMessages((previousMessages) => [
      ...previousMessages,
      { role: "learner", text: learnerMessage },
    ]);

    setMessage("");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] pb-32">
      <div className="mx-auto max-w-3xl">
        
        <div className="sticky top-0 z-50 border-b border-blue-100 bg-[#102A43] px-4 py-3 shadow-sm">
  <div className="mx-auto flex max-w-3xl items-center gap-3">
    <Link href="/chat">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
        <ArrowLeft
          size={24}
          color="white"
          strokeWidth={2.2}
        />
      </div>
    </Link>

    <Image
      src="/re-petersen.png"
      alt="Teacher Ronald"
      width={44}
      height={44}
      className="rounded-full border border-white/30 object-cover"
    />

    <div>
      <h1
        className={`${neueHaas.className}`}
        style={{
          color: "white",
          fontSize: "18px",
          fontWeight: 700,
          lineHeight: 1.1,
        }}
      >
        Teacher Ronald
      </h1>

      <p
        className={`${neueHaas.className}`}
        style={{
          color: "#d0d4dd",
          fontSize: "12px",
          fontWeight: 500,
          marginTop: "2px",
        }}
      >
        Faculty Chat
      </p>
    </div>
  </div>
</div>

        <div className="px-5 pt-5 pb-44 space-y-5">
          {messages.map((chatMessage, index) => (
            <div
              key={index}
              className={`rounded-[2rem] p-4 max-w-xl shadow-sm leading-relaxed border ${
                chatMessage.role === "learner"
                  ? "bg-[#EEF7FF] ml-auto text-slate-800 border-blue-200"
                  : "bg-white mr-auto text-slate-800 border-blue-100"
              }`}
            >
              <p
                className={`${neueHaas.className}`}
                style={{
                  color: "#64748b",
                  fontSize: "12px",
                  fontWeight: 700,
                  marginBottom: "4px",
                }}
              >
                {chatMessage.role === "learner" ? learner.name : "Teacher Ronald"}
              </p>

              <p
                className={`${neueHaas.className}`}
                style={{
                  color: "#0f172a",
                  fontSize: "15px",
                  lineHeight: 1.55,
                }}
              >
                {chatMessage.text}
              </p>
            </div>
          ))}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage();
          }}
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-100 bg-white p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]"
        >
          <div className="mx-auto flex max-w-3xl gap-3">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className={`${neueHaas.className} flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-500`}
              placeholder="Message Teacher Ronald..."
            />

            <button
              type="submit"
              className={`${neueHaas.className} rounded-2xl px-6 font-semibold text-white`}
              style={{
                backgroundColor: "#334155",
              }}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}