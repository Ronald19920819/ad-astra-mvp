import Image from "next/image";
import Link from "next/link";
import { learner } from "@/data/learners";
import { neueHaas } from "@/app/fonts";

export default function ChatPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-32">
      <div className="max-w-md mx-auto">

        {/* Hero Banner */}
        <div
          className="relative mb-6 overflow-hidden rounded-[2rem] border border-blue-100 shadow-lg"
          style={{
            height: "190px",
          }}
        >
          <Image
            src="/hero-banner.png"
            alt="Faculty Chat Banner"
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
              className={`${neueHaas.className}`}
              style={{
                color: "white",
                fontSize: "30px",
                fontWeight: 700,
              }}
            >
              Faculty Chat
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
              {learner.name} • Talk to your teachers.
            </p>
          </div>
        </div>

        {/* Teacher Card */}
        <div className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">

           <Image
  src="/re-petersen.png"
  alt="RE Petersen"
  width={64}
  height={64}
  className="rounded-full object-cover border border-blue-100"
/>

            <div className="flex-1">
              <h2
                className={`${neueHaas.className}`}
                style={{
                  color: "#0f172a",
                  fontSize: "20px",
                  fontWeight: 700,
                }}
              >
                RE Petersen
              </h2>

              <p className="text-sm font-semibold text-[#334155]">
                Business Studies
              </p>

            </div>
          </div>

          <Link href="/chat/re-petersen">
            <div className="mt-4 rounded-2xl bg-[#102A43] py-3 text-center text-sm font-bold text-white">
              Enter Chat
            </div>
          </Link>
        </div>

      </div>
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-blue-100 z-50">
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