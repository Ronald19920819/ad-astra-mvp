"use client";
import { Shadows_Into_Light } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { learner } from "@/data/learners";
import { neueHaas } from "@/app/fonts";

const ShadowsIntoLight = Shadows_Into_Light({
  weight: "400",
  subsets: ["latin"],
});

type ChatMessage = {
  role: "user" | "tutor";
  text: string;
};

export default function TutorPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  function sendMessage() {
    if (!message.trim()) return;

    const learnerMessage = message;

    setMessages((previousMessages) => [
      ...previousMessages,
      { role: "user", text: learnerMessage },
      {
        role: "tutor",
        text: "Good question. Before we look at the answer, let's make sure we understand what the question is really asking. Tell me what you think the key words are and what the examiner wants you to explain, analyse, or evaluate. We'll work through it together.",
      },
    ]);

    setMessage("");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] pb-32">
      <div className="mx-auto max-w-3xl">
        <div className="p-5 pb-0">
          <div
            className="relative mb-5 w-full overflow-hidden rounded-[2rem] border border-blue-100 bg-black shadow-lg"
            style={{
              height: "205px",
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
  className={`${ShadowsIntoLight.className} text-white leading-none`}
  style={{
    fontSize: "30px",
    fontWeight: 400,
    marginTop: "4px",
  }}
>
  Kingdom
</h1>

<div
  style={{
    marginTop: "2px",
    marginLeft: "15px",
    width: "50px",
    height: "6px",
    background: "#508db1",
    borderRadius: "50px 15px 50px 15px",
    opacity: 0.40,
  }}
/>

              <h1
                className={`${neueHaas.className}`}
                style={{
                  color: "white",
                  fontSize: "15px",
                  fontWeight: 500,
                  lineHeight: 1.1,
                  marginTop: "4px",
                }}
              >
                Tutor Dashboard
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
                {learner.name} • Learn • Revise • Explore
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 pb-44 space-y-5">
          <div className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
            <p
              className={`${neueHaas.className}`}
              style={{
                color: "0f172a",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              This is Kingdom, your tutor
            </p>

            <p
              className={`${neueHaas.className}`}
              style={{
                color: "#334155",
                fontSize: "16px",
                fontWeight: 200,
                lineHeight: 1.6,
                marginTop: "10px",
              }}
            >
              Hi {learner.name}. 

I'm Kingdom, your personal tutor.

I can help you understand concepts, revise for tests, practise questions, and improve your confidence across all of your subjects.

What would you like help with today?
            </p>
          </div>

          {messages.map((chatMessage, index) => (
            <div
              key={index}
              className={`rounded-[2rem] p-4 max-w-xl shadow-sm leading-relaxed border ${
                chatMessage.role === "user"
                  ? "bg-[#EEF7FF] mr-auto text-slate-800 border-blue-200"
                  : "bg-white ml-auto text-slate-800 border-yellow-200"
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
                {chatMessage.role === "user" ? learner.name : "Kingdom"}
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

          <div className="grid grid-cols-2 gap-3">
            {[
              "Explain a concept",
              "Help with a question",
              "Quiz me",
              "Revise weak areas",
            ].map((option) => (
              <button
                key={option}
                className={`${neueHaas.className} rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm shadow-sm`}
                style={{
                  color: "#334155",
                  fontWeight: 600,
                }}
              >
                {option}
              </button>
            ))}
          </div>
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
              placeholder="Ask Kingdom..."
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