import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  SquarePen,
  ChevronDown,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { neueHaas } from "@/app/fonts";

export default function AfrikaansActivities() {
  return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-12`}
    >
      <div className="max-w-md mx-auto">
        <div className="mb-6 rounded-[2rem] bg-[#102A43] p-5 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <Link href="/afrikaans-dashboard">
              <ArrowLeft size={22} />
            </Link>

            <Image
              src="/re-petersen.png"
              alt="Teacher Ronald"
              width={48}
              height={48}
              className="rounded-full"
            />

            <div>
              <h1 className="text-lg font-bold">
                Afrikaans Activities
              </h1>

              <p className="text-sm text-blue-100">
                Teacher Ronald
              </p>
            </div>
          </div>
        </div>

        <section className="mb-5 rounded-[2rem] border border-red-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-[#FFF1F1] p-3 text-[#eb2525]">
              <SquarePen size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                Current Activities
              </h2>
              <p className="text-sm text-black/60">
                Complete this week&apos;s work
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Link href="/business-studies-activity">
              <div className="rounded-2xl border border-red-100 bg-[#FFF8F8] p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-3">
                  <SquarePen size={18} className="text-[#eb2525]" />
                  <p className="text-sm font-bold text-black">
                    Aktiwiteit 15 - Les 2.5
                  </p>
                </div>

                <p className="mb-3 text-sm text-black/60">
                  Leesbegrip en Woordeskat
                </p>

                <div className="flex items-center gap-2 text-xs font-semibold text-[#eb2525]">
                  <Clock size={14} />
                  <p>Due Friday</p>
                </div>
              </div>
            </Link>

            <Link href="/business-studies-activity">
              <div className="rounded-2xl border border-red-100 bg-[#FFF8F8] p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-3">
                  <SquarePen size={18} className="text-[#eb2525]" />
                  <p className="text-sm font-bold text-black">
                    Aktiwiteit 16 - Les 2.6
                  </p>
                </div>

                <p className="mb-3 text-sm text-black/60">
                  Taalstrukture en Skryfwerk
                </p>

                <div className="flex items-center gap-2 text-xs font-semibold text-[#eb2525]">
                  <Clock size={14} />
                  <p>Due Friday</p>
                </div>
              </div>
            </Link>
          </div>
        </section>

        <section className="rounded-[2rem] border border-red-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#102A43]">
                All Weeks
              </h2>
              <p className="text-sm text-black/60">
                Tap a week to view its activities
              </p>
            </div>

            <ChevronDown size={22} className="text-[#eb2525]" />
          </div>

          <div className="space-y-3">
            <details className="rounded-2xl border border-red-100 bg-white p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#102A43]">
                    Week 3 • Term 2
                  </h3>

                  <p className="text-xs text-black/50">
                    2 current activities
                  </p>
                </div>

                <span className="rounded-full bg-[#FFF1F1] px-3 py-1 text-xs font-semibold text-[#eb2525]">
                  Current
                </span>
              </summary>

              <div className="mt-4 space-y-2">
                <Link href="/business-studies-activity">
                  <div className="rounded-2xl bg-[#FFF8F8] p-4 shadow-sm border border-red-100">
                    <div className="mb-1 flex items-center gap-3">
                      <SquarePen size={18} className="text-[#eb2525]" />
                      <p className="text-sm font-bold text-black">
                        Aktiwiteit 15 - Les 2.5
                      </p>
                    </div>

                    <p className="text-sm text-black/60">
                      Leesbegrip en Woordeskat
                    </p>
                  </div>
                </Link>

                <Link href="/business-studies-activity">
                  <div className="rounded-2xl bg-[#FFF8F8] p-4 shadow-sm border border-red-100">
                    <div className="mb-1 flex items-center gap-3">
                      <SquarePen size={18} className="text-[#eb2525]" />
                      <p className="text-sm font-bold text-black">
                        Aktiwiteit 16 - Les 2.6
                      </p>
                    </div>

                    <p className="text-sm text-black/60">
                      Taalstrukture en Skryfwerk
                    </p>
                  </div>
                </Link>
              </div>
            </details>

            <details className="rounded-2xl border border-red-100 bg-white p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#102A43]">
                    Week 2 • Term 2
                  </h3>

                  <p className="text-xs text-black/50">
                    2 activities
                  </p>
                </div>

                <CheckCircle2 size={18} className="text-green-600" />
              </summary>

              <div className="mt-4 space-y-2">
                <Link href="/business-studies-activity">
                  <div className="rounded-2xl bg-[#FFF8F8] p-4 shadow-sm border border-red-100">
                    <div className="mb-1 flex items-center gap-3">
                      <SquarePen size={18} className="text-[#eb2525]" />
                      <p className="text-sm font-bold text-black">
                        Aktiwiteit 13 - Les 2.3
                      </p>
                    </div>

                    <p className="text-sm text-black/60">
                      Begripstoets
                    </p>
                  </div>
                </Link>

                <Link href="/business-studies-activity">
                  <div className="rounded-2xl bg-[#FFF8F8] p-4 shadow-sm border border-red-100">
                    <div className="mb-1 flex items-center gap-3">
                      <SquarePen size={18} className="text-[#eb2525]" />
                      <p className="text-sm font-bold text-black">
                        Aktiwiteit 14 - Les 2.4
                      </p>
                    </div>

                    <p className="text-sm text-black/60">
                      Skryf met Doel
                    </p>
                  </div>
                </Link>
              </div>
            </details>

            <details className="rounded-2xl border border-red-100 bg-white p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#102A43]">
                    Week 1 • Term 2
                  </h3>

                  <p className="text-xs text-black/50">
                    2 activities
                  </p>
                </div>

                <AlertCircle size={18} className="text-red-500" />
              </summary>

              <div className="mt-4 space-y-2">
                <Link href="/business-studies-activity">
                  <div className="rounded-2xl bg-[#FFF8F8] p-4 shadow-sm border border-red-100">
                    <div className="mb-1 flex items-center gap-3">
                      <SquarePen size={18} className="text-[#eb2525]" />
                      <p className="text-sm font-bold text-black">
                        Aktiwiteit 11 - Les 2.1
                      </p>
                    </div>

                    <p className="text-sm text-black/60">
                      Woordsoorte
                    </p>
                  </div>
                </Link>

                <Link href="/business-studies-activity">
                  <div className="rounded-2xl bg-[#FFF8F8] p-4 shadow-sm border border-red-100">
                    <div className="mb-1 flex items-center gap-3">
                      <SquarePen size={18} className="text-[#eb2525]" />
                      <p className="text-sm font-bold text-black">
                        Aktiwiteit 12 - Les 2.2
                      </p>
                    </div>

                    <p className="text-sm text-black/60">
                      Sinstrukture
                    </p>
                  </div>
                </Link>
              </div>
            </details>
          </div>
        </section>
      </div>
    </main>
  );
}