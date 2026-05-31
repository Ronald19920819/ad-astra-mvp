import Link from "next/link";
export default function SubjectsPage() {
  return (
    <main className="min-h-screen bg-[#EEF7FF] p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-[#102A43] mb-2">
          Welcome Morgan
        </h1>

        <p className="text-slate-500 mb-8">
          Select a subject
        </p>

        <div className="space-y-4">
         <Link href="/business-studies">
  <div className="w-full bg-white p-5 rounded-2xl shadow text-left cursor-pointer hover:bg-blue-50">
    📘 Business Studies
  </div>
</Link>

          <button className="w-full bg-white p-5 rounded-2xl shadow text-left">
            📖 English
          </button>

          <button className="w-full bg-white p-5 rounded-2xl shadow text-left">
            🏛 History
          </button>
        </div>
      </div>
    </main>
  );
}