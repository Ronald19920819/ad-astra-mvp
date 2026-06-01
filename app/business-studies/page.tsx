"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Indie_Flower, Oxanium } from "next/font/google";
import { learner } from "@/data/learners";
const indieFlower = Indie_Flower({
  weight: "400",
  subsets: ["latin"],
});
const oxanium = Oxanium({
  weight: "600",
  subsets: ["latin"],
});

type ChatMessage = {
  role: "user" | "tutor";
  text: string;
};

export default function BusinessStudiesPage() {
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
        text: "Let’s break this down. I can help you understand the question, but I won’t give you the full answer. First, tell me what you think the question is asking.",
      },
    ]);

    setMessage("");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] pb-32">
      <div className="max-w-3xl mx-auto">
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur shadow-sm p-4 flex items-center gap-4 border-b border-blue-100">
          <Image
            src="/ad_astra_logo.png"
            alt="AD Astra Logo"
            width={54}
            height={54}
          />

          <div>
    <p className={`${oxanium.className} text-2xl font-semibold text-black tracking-wide leading-none`}>
  AD ASTRA
</p>

            <h1
              className={`${indieFlower.className} text-4xl text-[#102A43] leading-tight`}
            >
              Business Studies
            </h1>

            <p className="text-sm text-slate-500">
              {learner.name} • Focus: Application Questions
            </p>
          </div>
        </div>
<div className="flex gap-3 mt-2 text-xs font-semibold text-black">
  <Link href="/home">Home</Link>
  <Link href="/subjects">Subjects</Link>
  <Link href="/schedule">Schedule</Link>
  <Link href="/profile">Profile</Link>
</div>
        <div className="p-5 space-y-5 pb-44">
          <div className="bg-white rounded-3xl shadow-sm p-5 max-w-xl border border-blue-100">
            <p className="font-semibold text-[#102A43] mb-2">
              AD Astra Tutor
            </p>

            <p className="text-slate-700 leading-relaxed">
              Hi {learner.name}. Welcome back to Business Studies. You have been
              improving with definitions, but we still need to work on
              application questions. What would you like help with today?
            </p>
          </div>

          {messages.map((chatMessage, index) => (
            <div
              key={index}
              className={`rounded-3xl p-4 max-w-xl shadow-sm leading-relaxed ${
                chatMessage.role === "user"
                  ? "bg-blue-100 mr-auto text-slate-800 border border-blue-200"
                  : "bg-white ml-auto text-slate-800 border border-yellow-200"
              }`}
            >
              <p className="text-xs font-semibold mb-1 text-slate-500">
                {chatMessage.role === "user" ? "{learner.name}" : "AD Astra Tutor"}
              </p>

              <p>{chatMessage.text}</p>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <button className="bg-white rounded-2xl shadow-sm border border-blue-100 px-4 py-3 text-sm text-slate-700">
              Explain a concept
            </button>

            <button className="bg-white rounded-2xl shadow-sm border border-blue-100 px-4 py-3 text-sm text-slate-700">
              Help with a question
            </button>

            <button className="bg-white rounded-2xl shadow-sm border border-blue-100 px-4 py-3 text-sm text-slate-700">
              Quiz me
            </button>

            <button className="bg-white rounded-2xl shadow-sm border border-blue-100 px-4 py-3 text-sm text-slate-700">
              Revise weak areas
            </button>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage();
          }}
          className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-blue-100 p-4"
        >
          <div className="max-w-3xl mx-auto flex gap-3">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="flex-1 border border-slate-300 rounded-2xl px-4 py-3 text-slate-800 outline-none focus:border-blue-500"
              placeholder="Ask your tutor..."
            />

            <button
              type="submit"
              className="bg-[#102A43] text-white px-6 rounded-2xl font-semibold"
            >
              Send
            </button>
          </div>
        </form>
      </div>
      
    </main>
  );
}