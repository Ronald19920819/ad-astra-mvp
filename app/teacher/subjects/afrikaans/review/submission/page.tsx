import Link from "next/link";
import {
  ArrowLeft,
  Download,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";

export default function AfrikaansSubmissionReviewPage() {
  const questions = [
    
  {
    number: "Vraag 1",
    marks: 2,
    question: "Identifiseer twee selfstandige naamwoorde in die sin.",
    answer:
      "Die woorde 'kind' en 'boek'.",
    kingdomComment:
      "Korrek. Beide woorde is selfstandige naamwoorde.",
    kingdomMark: "2/2",
  },
  {
    number: "Vraag 2",
    marks: 4,
    question: "Verduidelik waarom leestekens belangrik is.",
    answer:
      "Leestekens help die leser om die betekenis van sinne beter te verstaan en voorkom misverstande.",
    kingdomComment:
      "Goeie verduideliking. Die antwoord toon begrip van die doel van leestekens. Nog 'n voorbeeld sou die antwoord versterk.",
    kingdomMark: "3/4",
  },
  {
    number: "Vraag 3",
    marks: 4,
    question: "Skryf 'n sin wat 'n byvoeglike naamwoord bevat.",
    answer:
      "Die groot hond hardloop vinnig oor die veld.",
    kingdomComment:
      "Korrek. Die woord 'groot' word korrek as 'n byvoeglike naamwoord gebruik.",
    kingdomMark: "4/4",
  },
];

  return (
    <main className="min-h-screen bg-slate-100 pb-24">
      <div className="mx-auto max-w-md px-4 pt-4">
        {/* Header */}
        <div className="mb-5 rounded-[2rem] border border-red-100 bg-white p-5 shadow-sm">
          <Link
            href="/teacher/subjects/afrikaans/review"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-red-500"
          >
            <ArrowLeft size={16} />
            Back to Activity Review
          </Link>

          <h1 className="text-3xl font-bold text-slate-900">
            Submission Review
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Afrikaans Faculty
          </p>
        </div>

        {/* Activity Details */}
        <div className="mb-5 rounded-[2rem] border border-red-100 bg-red-50 p-5">
          <h2 className="text-lg font-bold text-slate-900">
            Aktiwiteit 7 - Les 2.7
          </h2>

          <p className="mt-1 text-sm font-semibold text-slate-700">
            Taalstrukture • 20 Punte • Sperdatum: 16/06/26
          </p>

          <p className="mt-3 text-sm text-slate-600">
            Learner: Danielle Coetzee
          </p>
        </div>

        {/* Question-by-question review */}
        <div className="space-y-5">
          {questions.map((item) => (
            <div
              key={item.number}
              className="rounded-[2rem] border border-red-100 bg-white p-5 shadow-sm"
            >
              <div className="mb-3">
                <h2 className="font-bold text-slate-900">
                  {item.number} ({item.marks} marks)
                </h2>

                <p className="mt-1 text-sm font-semibold text-slate-700">
                  {item.question}
                </p>
              </div>

              <div className="mb-4 rounded-2xl bg-slate-50 p-4">
                <p className="mb-1 text-xs font-bold text-slate-500">
                  Learner Answer
                </p>

                <p className="text-sm leading-relaxed text-slate-700">
                  {item.answer}
                </p>
              </div>

              <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="text-red-500" size={17} />
                  <p className="text-sm font-bold text-slate-900">
                    Kingdom Draft Result
                  </p>
                </div>

                <p className="mb-2 text-sm leading-relaxed text-slate-700">
                  {item.kingdomComment}
                </p>

                <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                  ✓ {item.kingdomMark}
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="mb-3 text-sm font-bold text-slate-900">
                  Teacher Final Review
                </p>

                <label className="mb-2 block text-xs font-semibold text-slate-600">
                  Teacher Mark
                </label>

                <div className="mb-3 flex items-center gap-2">
                  <input
                    placeholder={item.kingdomMark.split("/")[0]}
                    className="w-20 rounded-2xl border border-slate-200 p-3 text-center text-sm font-bold outline-none"
                  />
                  <span className="text-sm font-semibold text-slate-600">
                    /{item.marks}
                  </span>
                </div>

                <label className="mb-2 block text-xs font-semibold text-slate-600">
                  Teacher Comment
                </label>

                <textarea
                  placeholder="Confirm or adjust Kingdom's feedback..."
                  className="min-h-[90px] w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Final Review Actions */}
        <div className="mt-5 rounded-[2rem] border border-red-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-slate-900">
            Final Review
          </h2>

          <div className="mb-4 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-600">
              Kingdom Draft Final Mark
            </p>
            <p className="text-2xl font-bold text-red-500">9/10</p>
            <p className="text-sm text-slate-500">90%</p>
          </div>

          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Teacher Final Mark
          </label>

          <div className="mb-4 flex items-center gap-3">
            <input
              placeholder="9"
              className="w-24 rounded-2xl border border-slate-200 p-3 text-center font-bold outline-none"
            />
            <span className="font-semibold text-slate-600">/10</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button className="flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white py-3 text-sm font-semibold text-red-500">
              <Download size={17} />
              Save PDF
            </button>

            <button className="flex items-center justify-center gap-2 rounded-2xl bg-red-500 py-3 text-sm font-semibold text-white">
              <RotateCcw size={17} />
              Return
            </button>
          </div>

          <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white">
            <Save size={17} />
            Save Draft Review
          </button>
        </div>
      </div>
    </main>
  );
}