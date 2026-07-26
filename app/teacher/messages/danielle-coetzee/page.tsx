"use client";

import { useState } from "react";
import { neueHaas } from "@/app/fonts";
import { AuthenticatedTeacherName } from "@/components/teachers/AuthenticatedTeacherName";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type ChatMessage = {
  role: "teacher" | "learner";
  text: string;
};

export default function TeacherLearnerChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
   {
  role: "learner",
  text: "Sir, can you please explain the case study question again? I am not sure how much detail I need to include.",
},
  ]);

  function sendMessage() {
    if (!message.trim()) return;

   const teacherMessage = message;

setMessages((previousMessages) => [
  ...previousMessages,
  { role: "teacher", text: teacherMessage },
]);

    setMessage("");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] pb-32">
      <div className="mx-auto max-w-3xl">
        
        <div className="sticky top-0 z-50 border-b border-blue-100 bg-[#102A43] px-4 py-3 shadow-sm">
  <div className="mx-auto flex max-w-3xl items-center gap-3">
    <Link href="/teacher/messages">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
        <ArrowLeft
          size={24}
          color="white"
          strokeWidth={2.2}
        />
      </div>
    </Link>

    <div
      aria-label="Learner profile"
      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/15 text-sm font-bold text-white"
    >
      L
    </div>

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
        Learner
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
        Learner Chat
      </p>
    </div>
  </div>
</div>

        <div className="px-5 pt-5 pb-44 space-y-5">
          {messages.map((chatMessage, index) => (
            <div
              key={index}
              className={`rounded-[2rem] p-4 max-w-xl shadow-sm leading-relaxed border ${
                chatMessage.role === "teacher"
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
                {chatMessage.role === "teacher"
                    ? <AuthenticatedTeacherName />
                    : "Learner"}
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
              placeholder="Message learner..."
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
