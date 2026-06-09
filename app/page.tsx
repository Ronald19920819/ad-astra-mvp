import Image from "next/image";
import Link from "next/link";
import { neueHaas } from "@/app/fonts";

export default function Home() {
  return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] flex items-center justify-center p-6`}
    >
      <div className="w-full max-w-sm rounded-[2rem] bg-white/95 shadow-xl p-8 border border-blue-100">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <Image
              src="/ad_astra_logo.png"
              alt="AD Astra Logo"
              width={190}
              height={190}
              priority
            />
          </div>


          
        </div>

        <div className="space-y-4">
          <input
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none focus:border-[#508DB1]"
            placeholder="Username"
          />

          <input
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none focus:border-[#508DB1]"
            placeholder="Password"
            type="password"
          />

          <Link href="/home">
            <div className="w-full cursor-pointer rounded-2xl bg-[#102A43] py-3 text-center font-semibold text-white shadow-md">
              Learner Login
            </div>
          </Link>

          <Link href="/teacher">
            <div className="w-full cursor-pointer rounded-2xl border border-blue-100 bg-[#F8FBFF] py-3 text-center font-semibold text-[#102A43] shadow-sm">
              Teacher Login
            </div>
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-black/50">
          AD Astra Learning System
        </p>
      </div>
    </main>
  );
}