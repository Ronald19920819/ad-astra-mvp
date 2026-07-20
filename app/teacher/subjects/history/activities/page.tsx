"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ClipboardList,
  FileUp,
  FileText,
  CalendarDays,
  Plus,
  Rocket,
} from "lucide-react";

export default function HistoryActivitiesPage() {
  const [activityTitle, setActivityTitle] = useState("");
  const [linkedLesson, setLinkedLesson] = useState("");
  const [marks, setMarks] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [activities, setActivities] = useState([
    {
      title: "Activity 6 - The Cold War",
      lesson: "Lesson 2.6",
      marks: "20",
      due: "Friday",
      status: "Published",
    },
    {
      title: "Activity 7 - Who Was More to Blame for the Cold War?",
      lesson: "Lesson 2.7",
      marks: "20",
      due: "Friday",
      status: "Published",
    },
  ]);

  const publishActivity = () => {
    if (!activityTitle.trim()) return;

    setActivities([
      {
        title: activityTitle,
        lesson: linkedLesson || "Not linked",
        marks: marks || "0",
        due: dueDate || "No due date",
        status: "Published",
      },
      ...activities,
    ]);

    setActivityTitle("");
    setLinkedLesson("");
    setMarks("");
    setDueDate("");
  };

  return (
    <main className="min-h-screen bg-slate-100 pb-24">
      <div className="mx-auto max-w-md px-4 pt-3">
        {/* Hero Banner */}
        <div
          className="relative mb-5 w-full overflow-hidden rounded-[2rem] border border-blue-100 shadow-lg"
          style={{ height: "240px" }}
        >
          <Image
            src="/hero-banner-2.png"
            alt="Teacher Hero Banner"
            width={1400}
            height={750}
            priority
            className="absolute left-0 top-0 h-full w-full object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />

          <div className="relative z-10 h-full p-5 flex flex-col pt-2">
            <div className="flex items-center gap-3 mb-3">
              <Image
                src="/ad_astra_logo.png"
                alt="AD Astra Logo"
                width={58}
                height={58}
                unoptimized
                className="bg-transparent"
              />

              <Image
                src="/ad_astra_wordmark_2.png"
                alt="AD ASTRA"
                width={180}
                height={47}
                priority
                style={{
                  width: "180px",
                  height: "auto",
                }}
              />
            </div>

            <div className="mt-auto">
              <Link
                href="/teacher/subjects/history"
                className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur"
              >
                <ArrowLeft size={16} />
                Back to Dashboard
              </Link>

              <h1 className="text-3xl font-bold text-white">
                Activity Centre
              </h1>

              <p className="mt-1 text-sm text-white/90">
                History Faculty
              </p>
            </div>
          </div>
        </div>

        {/* Create Activity */}
        <div className="mb-5 rounded-[2rem] border border-green-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-green-50 p-3">
              <Plus className="text-green-500" size={22} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Create Activity
              </h2>
              <p className="text-sm text-slate-500">
                Attach learner work to a published lesson
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <input
              value={activityTitle}
              onChange={(e) => setActivityTitle(e.target.value)}
              placeholder="Activity Title"
              className="w-full rounded-2xl border border-slate-200 p-3 outline-none"
            />

            <input
              value={linkedLesson}
              onChange={(e) => setLinkedLesson(e.target.value)}
              placeholder="Linked Lesson e.g. Lesson 2.7"
              className="w-full rounded-2xl border border-slate-200 p-3 outline-none"
            />

            <input
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
              placeholder="Total Marks"
              className="w-full rounded-2xl border border-slate-200 p-3 outline-none"
            />

            <input
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              placeholder="Due Date"
              className="w-full rounded-2xl border border-slate-200 p-3 outline-none"
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-green-50 p-4 text-center">
              <FileUp className="mx-auto mb-2 text-green-500" size={20} />
              <p className="text-xs font-medium">Upload File</p>
            </div>

            <div className="rounded-2xl bg-green-50 p-4 text-center">
              <ClipboardList className="mx-auto mb-2 text-green-500" size={20} />
              <p className="text-xs font-medium">Worksheet</p>
            </div>

            <div className="rounded-2xl bg-green-50 p-4 text-center">
              <CalendarDays className="mx-auto mb-2 text-green-500" size={20} />
              <p className="text-xs font-medium">Due Date</p>
            </div>
          </div>

          <button
            onClick={publishActivity}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-green-500 py-3 font-semibold text-white"
          >
            <Rocket size={18} />
            Publish Activity
          </button>
        </div>

        {/* Published Activities */}
        <div className="rounded-[2rem] border border-green-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-green-50 p-3">
              <FileText className="text-green-500" size={22} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Published Activities
              </h2>
              <p className="text-sm text-slate-500">
                Activities available to learners
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {activities.map((activity, index) => (
              <div
                key={index}
                className="rounded-2xl border border-green-100 p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-slate-900">
                    {activity.title}
                  </h3>

                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                    {activity.status}
                  </span>
                </div>

                <p className="text-sm text-slate-500">
                  {activity.lesson} • {activity.marks} marks • Due:{" "}
                  {activity.due}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-100 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid max-w-md grid-cols-5 text-center text-sm text-black">
          <Link href="/teacher">
            <div className="py-4">Home</div>
          </Link>

          <Link href="/teacher/subjects">
            <div className="py-4 text-[#508DB1]">Subjects</div>
          </Link>

          <Link href="/teacher/messages">
            <div className="py-4">Messages</div>
          </Link>

          <Link href="/teacher/reports">
            <div className="py-4">Reports</div>
          </Link>

          <Link href="/teacher/profile">
            <div className="py-4">Profile</div>
          </Link>
        </div>
      </nav>
    </main>
  );
}