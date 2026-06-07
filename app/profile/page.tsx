import Image from "next/image";
import Link from "next/link";
import { Shadows_Into_Light } from "next/font/google";
import { learner } from "@/data/learners";
import { neueHaas } from "@/app/fonts";
import {
  User,
  FileText,
  Coins,
  Settings,
  Lock,
  CreditCard,
  BookOpen,
  BookX,
} from "lucide-react";

const shadowsIntoLight = Shadows_Into_Light({
  weight: "400",
  subsets: ["latin"],
});



export default function ProfilePage() {
  return (
   <main className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-28`}>
      <div className="max-w-md mx-auto">
        <section className="flex flex-col items-center text-center mb-6">
  <Image
    src="/ad_astra_logo.png"
    alt="AD Astra Logo"
    width={82}
    height={82}
    className="mb-4"
  />

  <Image
    src="/ad_astra_wordmark.png"
    alt="AD Astra"
    width={220}
    height={50}
    className="mb-2 h-auto w-auto"
  />

  <h1 className={`${shadowsIntoLight.className} mt-2 text-[34px] text-black leading-tight`}>
    {learner.name}
  </h1>

  <p className="mt-1 text-sm font-medium text-black/60">
    Learner details and settings
  </p>

  <div className="relative mt-5">
    <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-white shadow-lg">
      <Image
        src="/learner-profile.png"
        alt="Learner Profile Picture"
        width={128}
        height={128}
        className="h-full w-full object-cover"
      />
    </div>

    <div className="absolute bottom-1 right-1 rounded-full bg-[#102A43] px-3 py-1 text-xs font-semibold text-white shadow-sm">
      Edit
    </div>
  </div>
</section>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
              <User size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Learner Information
              </h2>
              <p className="text-xs font-medium text-black/50">
                Basic learner profile
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-black">
            <p><span className="font-semibold">Name and Surname:</span> {learner.name}</p>
            <p><span className="font-semibold">Learner ID:</span> 001</p>
            <p><span className="font-semibold">Subjects:</span> 4</p>
            <p><span className="font-semibold">School:</span> Clift College</p>
          </div>
        </section>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
              <FileText size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Learner Reports
              </h2>
              <p className="text-xs font-medium text-black/50">
                Teacher progress updates
              </p>
            </div>
          </div>

          <p className="mb-4 text-sm leading-relaxed text-black/70">
            Access progress reports generated and sent by teachers every two months.
          </p>

          <button className="w-full rounded-2xl bg-[#102A43] py-3 text-sm font-semibold text-white shadow-sm">
            View Reports
          </button>
        </section>

        <section className="mb-5 rounded-[2rem] border border-yellow-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#FFF8E6] p-3 text-[#D9A106]">
              <Coins size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                AD Astra Coins
              </h2>
              <p className="text-xs font-medium text-black/50">
                Performance rewards
              </p>
            </div>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-5xl font-bold text-[#D9A106]">0</p>
              <p className="text-sm text-black/60">Coins earned</p>
            </div>

            <p className="max-w-[170px] text-right text-sm leading-relaxed text-black/70">
              Earn coins through strong activity performance.
            </p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
              <Settings size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Settings
              </h2>
              <p className="text-xs font-medium text-black/50">
                Manage learner account
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button className="flex w-full items-center gap-3 rounded-2xl border border-blue-100 bg-[#F8FBFF] px-4 py-3 text-left text-sm font-semibold text-black">
              <Lock size={18} className="text-[#508DB1]" />
              Change Password
            </button>

            <button className="flex w-full items-center gap-3 rounded-2xl border border-blue-100 bg-[#F8FBFF] px-4 py-3 text-left text-sm font-semibold text-black">
              <CreditCard size={18} className="text-[#508DB1]" />
              Upgrade Subscription Plan
            </button>

            <button className="flex w-full items-center gap-3 rounded-2xl border border-blue-100 bg-[#F8FBFF] px-4 py-3 text-left text-sm font-semibold text-black">
              <BookOpen size={18} className="text-[#508DB1]" />
              Register for Subjects
            </button>

            <button className="flex w-full items-center gap-3 rounded-2xl border border-blue-100 bg-[#F8FBFF] px-4 py-3 text-left text-sm font-semibold text-black">
              <BookX size={18} className="text-[#508DB1]" />
              Deregister Subjects
            </button>
          </div>
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-blue-100 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="max-w-md mx-auto grid grid-cols-5 text-center text-sm  text-black">
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
            <div className="py-4 text-[#508DB1]">Profile</div>
          </Link>
        </div>
      </nav>
    </main>
  );
}