import Image from "next/image";
import Link from "next/link";
import { neueHaas } from "@/app/fonts";
export default function TutorSuggestion() {
  return (
    <div className="rounded-[1.8rem] bg-[#FCE49B] p-5 shadow-lg mb-5 overflow-hidden relative">
      <div className="relative z-10 max-w-[65%]">
        <p className="mt-2 text-m font-bold text-[#131313]/80 leading-relaxed">
          Meet Kingdom, your tutor
        </p>

        <h2 className="mt-2 text-2xl font-bold text-white leading-tight">
          Need help with today’s work?
        </h2>

        <p className="mt-2 text-sm font-bold text-[#131313] leading-relaxed">
          Kingdom can help you think through your Business Studies activity.
        </p>

        <Link href="/tutor">
          <div className="mt-4 rounded-[1rem] shadow-sm bg-[#F5F0E5] py-3 text-center text-sm font-bold text-black">
            Open Tutor
          </div>
        </Link>
      </div>

      <Image
  src="/kingdom-tutor.png"
  alt="Kingdom Tutor"
  width={170}
  height={210}
  style={{
    width: "170px",
    height: "auto",
  }}
  className="absolute right-[-10px] bottom-0"
/>
    </div>
  );
}