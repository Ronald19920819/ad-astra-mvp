import Image from "next/image";
import Link from "next/link";
import { Shadows_Into_Light } from "next/font/google";
import { neueHaas } from "@/app/fonts";
import {
  User,
  GraduationCap,
  Coins,
  FileText,
  Settings,
} from "lucide-react";

const shadowsIntoLight = Shadows_Into_Light({
  weight: "400",
  subsets: ["latin"],
});

export default function TeacherProfilePage() {
  return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-32`}
    >
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
            src="/ad_astra_wordmark_2.png"
            alt="AD Astra"
            width={220}
            height={50}
            className="mb-2 h-auto w-auto"
          />

          <h1
            className={`${shadowsIntoLight.className} mt-2 text-[34px] text-black leading-tight`}
          >
            RE Petersen
          </h1>

          <p className="mt-1 text-sm font-medium text-black/60">
            Teacher details and settings
          </p>

          <div className="relative mt-5">
            <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-white shadow-lg">
              <Image
                src="/re-petersen.png"
                alt="Teacher Profile"
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
          <div className="mb-3 flex items-center gap-3">
            <User size={22} className="text-[#508DB1]" />
            <h2 className="text-lg font-bold text-[#102A43]">
              Teacher Information
            </h2>
          </div>

          <div className="space-y-2 text-sm">
            <p><strong>Name:</strong> RE Petersen</p>
            <p><strong>Teacher ID:</strong> T001</p>
            <p><strong>School:</strong> Clift College</p>
            <p><strong>Role:</strong> Faculty Teacher</p>
            <p><strong>Subjects Managed:</strong> 4</p>
          </div>
        </section>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <GraduationCap size={22} className="text-[#508DB1]" />
            <h2 className="text-lg font-bold text-[#102A43]">
              Teaching Overview
            </h2>
          </div>

          <div className="space-y-2 text-sm">
            <p><strong>Active Learners:</strong> 28</p>
            <p><strong>Published Lessons:</strong> 16</p>
            <p><strong>Activities Uploaded:</strong> 24</p>
            <p><strong>Reports Generated:</strong> 8</p>
          </div>
        </section>

        <section className="mb-5 rounded-[2rem] border border-yellow-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <Coins size={22} className="text-[#F59E0B]" />
            <h2 className="text-lg font-bold text-[#102A43]">
              AD Astra Coins
            </h2>
          </div>

          <div className="text-center py-2">
            <p className="text-4xl font-bold text-[#F59E0B]">
              125
            </p>

            <p className="mt-1 text-sm font-semibold text-black/70">
              Faculty Coins
            </p>
          </div>

          <p className="mt-3 text-sm text-black/70 leading-relaxed">
            Earn coins by creating lessons, uploading readings,
            publishing activities, reviewing learner work and
            contributing course content to the AD Astra system.
          </p>
        </section>

        

        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <Settings size={22} className="text-[#508DB1]" />
            <h2 className="text-lg font-bold text-[#102A43]">
              Settings
            </h2>
          </div>

          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-[#F8FBFF] p-3 font-semibold">
              Change Password
            </div>

            <div className="rounded-xl bg-[#F8FBFF] p-3 font-semibold">
              Notification Settings
            </div>

            <div className="rounded-xl bg-[#F8FBFF] p-3 font-semibold"> 
              Subscription & Plan
            </div>

            <div className="rounded-xl bg-[#F8FBFF] p-3 text-red-600 font-semibold">
              Sign Out
            </div>
          </div>
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-100 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm  text-black">
          <Link href="/teacher">
            <div className="py-4">Home</div>
          </Link>

          <Link href="/teacher/subjects">
            <div className="py-4">Subjects</div>
          </Link>

          <Link href="/teacher/messages">
            <div className="py-4">Messages</div>
          </Link>

          <Link href="/teacher/reports">
            <div className="py-4">Reports</div>
          </Link>

          <Link href="/teacher/profile">
            <div className="py-4 text-[#508DB1]">Profile</div>
          </Link>
        </div>
      </nav>
    </main>
  );
}