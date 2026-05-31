import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#EEF7FF] flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-xl p-8 border border-blue-100">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/ad_astra_logo.png"
              alt="AD Astra Logo"
              width={140}
              height={140}
              priority
            />
          </div>

          <h1 className="text-3xl font-bold text-[#102A43]">
            AD ASTRA
          </h1>

          <p className="text-sm text-slate-500 mt-2">
            Personal AI Tutor
          </p>
        </div>

        <div className="space-y-4">
          <input
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-500"
            placeholder="Username"
          />

          <input
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-500"
            placeholder="Password"
            type="password"
          />

          <Link href="/subjects">
            <div className="w-full rounded-xl bg-[#102A43] py-3 font-semibold text-white hover:bg-[#163B5C] text-center cursor-pointer">
              Login
            </div>
          </Link>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          AD Astra Learning System
        </p>
      </div>
    </main>
  );
}