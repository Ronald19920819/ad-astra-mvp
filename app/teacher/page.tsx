import Image from "next/image";
import Link from "next/link";
import { neueHaas } from "@/app/fonts";
import {
  School,
  ClipboardCheck,
  BookOpen,
  Users,
  AlertCircle,
  Upload,
  FileText,
  MessageCircle,
  BarChart3,
} from "lucide-react";

export default function TeacherHomePage() {
  return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-36`}
    >
      <div className="max-w-md mx-auto">
        <div
          className="relative mb-6 overflow-hidden rounded-[2rem] border border-blue-100 bg-black shadow-lg"
          style={{
            height: "260px",
            backgroundImage: "url('/hero-banner-2.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />

          <div className="relative z-10 h-full p-6 flex flex-col pt-3">
           <div className="flex items-center gap-4 mb-4 -mt-4">
  <Image
    src="/ad_astra_logo.png"
    alt="AD Astra Logo"
    width={70}
    height={70}
    unoptimized
    className="bg-transparent"
  />

  <Image
    src="/ad_astra_wordmark_2.png"
    alt="AD ASTRA"
    width={210}
    height={55}
    priority
    style={{
      width: "210px",
      height: "auto",
    }}
  />
</div>

            <h1
              style={{
                color: "white",
                fontSize: "20px",
                fontWeight: 700,
                lineHeight: 1.1,
              }}
            >
              Faculty Dashboard
            </h1>

            <p
              style={{
                color: "#d0d4dd",
                fontSize: "14px",
                fontWeight: 500,
                marginTop: "6px",
              }}
            >
              RE Petersen • Clift College
            </p>
          </div>
        </div>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
              <School size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                School Overview
              </h2>
              <p className="text-xs font-medium text-black/50">
                Faculty activity summary
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[#F8FBFF] p-4">
              <p className="text-2xl font-bold text-[#102A43]">4</p>
              <p className="text-xs font-medium text-black/60">
                Subjects Managed
              </p>
            </div>

            <div className="rounded-2xl bg-[#F8FBFF] p-4">
              <p className="text-2xl font-bold text-[#102A43]">28</p>
              <p className="text-xs font-medium text-black/60">
                Learners
              </p>
            </div>

            <div className="rounded-2xl bg-[#F8FBFF] p-4">
              <p className="text-2xl font-bold text-[#F97316]">12</p>
              <p className="text-xs font-medium text-black/60">
                Pending Reviews
              </p>
            </div>

            <div className="rounded-2xl bg-[#F8FBFF] p-4">
              <p className="text-2xl font-bold text-red-500">5</p>
              <p className="text-xs font-medium text-black/60">
                Need Attention
              </p>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#FFF3E6] p-3 text-[#F97316]">
              <ClipboardCheck size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Priority Actions
              </h2>
              <p className="text-xs font-medium text-black/50">
                What needs attention today
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-orange-100 bg-[#FFFDF9] p-4">
              <p className="text-sm font-bold text-black">
                Business Studies Activity 16
              </p>
              <p className="mt-1 text-xs font-medium text-black/50">
                12 submissions awaiting review
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-[#F8FBFF] p-4">
              <p className="text-sm font-bold text-black">
                English Activities
              </p>
              <p className="mt-1 text-xs font-medium text-black/50">
                4 learners have not submitted this week
              </p>
            </div>

            <div className="rounded-2xl border border-green-100 bg-[#F7FFF5] p-4">
              <p className="text-sm font-bold text-black">
                History Coursework
              </p>
              <p className="mt-1 text-xs font-medium text-black/50">
                3 learners need feedback
              </p>
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#EEF7FF] p-3 text-[#508DB1]">
              <BookOpen size={22} />
            </div>

            

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Learner Insights
              </h2>
              <p className="text-xs font-medium text-black/50">
                Early patterns and learner signals
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-black/70">
            <div className="flex items-start gap-3">
              <BarChart3 size={18} className="mt-0.5 text-[#508DB1]" />
              <p>3 learners improved their average this week.</p>
            </div>

            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="mt-0.5 text-red-500" />
              <p>2 learners have repeated late submissions.</p>
            </div>

            <div className="flex items-start gap-3">
              <ClipboardCheck size={18} className="mt-0.5 text-[#F97316]" />
              <p>Business Studies application questions remain the weakest area.</p>
            </div>
          </div>
        </section>

        
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-blue-100 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="max-w-md mx-auto grid grid-cols-5 text-center text-sm  text-black">
          <Link href="/teacher">
            <div className="py-4 text-[#508DB1]">Home</div>
          </Link>

          <Link href="/teacher/subjects">
            <div className="py-4">Subjects</div>
          </Link>

          <Link href="/teacher/review">
            <div className="py-4">Review</div>
          </Link>

          <Link href="/teacher/messages">
            <div className="py-4">Messages</div>
          </Link>

          <Link href="/teacher/profile">
            <div className="py-4">Profile</div>
          </Link>
        </div>
      </nav>
    </main>
  );
}