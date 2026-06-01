import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-[2rem] bg-white/95 shadow-xl p-8 border border-blue-100">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <Image
              src="/ad_astra_logo.png"
              alt="AD Astra Logo"
              width={240}
height={240}
              priority
            />
          </div>

       
        </div>

        <div className="space-y-4">
          <input
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-500 bg-white"
            placeholder="Username"
          />

          <input
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-500 bg-white"
            placeholder="Password"
            type="password"
          />

          <Link href="/home">
            <div className="w-full rounded-2xl bg-black py-3 font-semibold text-white text-center cursor-pointer shadow-md">
  Login
</div>
          </Link>
        </div>

        <p className="text-center text-xs text-black mt-6">
  AD Astra Learning System
</p>
      </div>
    </main>
  );
}