import Link from "next/link";
import {
  ArrowLeft,
  Download,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";

export default function EnglishSubmissionReviewPage() {
  const questions = [
  {
    number: "Question 1",
    marks: 4,
    question:
      "Identify one way the writer makes the character memorable.",
    answer:
      "The writer makes the character memorable by describing how he speaks in short, sharp sentences. This makes him seem nervous and unusual.",
    kingdomComment:
      "Good answer. You identify a clear technique and explain its effect on the character. To improve, include a short quotation from the text.",
    kingdomMark: "3/4",
  },
  {
    number: "Question 2",
    marks: 6,
    question:
      "Explain how sentence structure is used to reveal the character's personality.",
    answer:
      "The short sentences show that the character is tense and unsure. Longer sentences are used when he starts explaining his ideas, which shows that he becomes more confident.",
    kingdomComment:
      "Sound explanation. You link sentence length to the character's changing confidence. More precise reference to the text would make the response stronger.",
    kingdomMark: "4/6",
  },
  {
    number: "Question 3",
    marks: 10,
    question:
      "Write a paragraph analysing how the writer creates an original character.",
    answer:
      "The writer creates an original character by using unusual behaviour, sharp dialogue and changes in sentence structure. At first, the character seems awkward because his speech is broken into short phrases. Later, his thoughts become more detailed, which helps the reader understand him better.",
    kingdomComment:
      "Good paragraph. You discuss language and sentence structure, and you explain how these shape the reader's view of the character. Add more detailed evidence and comment on punctuation for a higher mark.",
    kingdomMark: "7/10",
  },
];

  return (
    <main className="min-h-screen bg-slate-100 pb-24">
      <div className="mx-auto max-w-md px-4 pt-4">
        {/* Header */}
        <div className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <Link
            href="/teacher/subjects/english/review"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-500"
          >
            <ArrowLeft size={16} />
            Back to Activity Review
          </Link>

          <h1 className="text-3xl font-bold text-slate-900">
            Submission Review
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            English Faculty
          </p>
        </div>

        {/* Activity Details */}
        <div className="mb-5 rounded-[2rem] border border-blue-100 bg-blue-50 p-5">
          <h2 className="text-lg font-bold text-slate-900">
            Activity 7 - Lesson 2.7
          </h2>

          <p className="mt-1 text-sm font-semibold text-slate-700">
            Creating Original Characters • 20 Marks • Due: 16/06/26
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
              className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm"
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

              <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="text-blue-500" size={17} />
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
        <div className="mt-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-slate-900">
            Final Review
          </h2>

          <div className="mb-4 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-600">
              Kingdom Draft Final Mark
            </p>
            <p className="text-2xl font-bold text-blue-500">14/20</p>
            <p className="text-sm text-slate-500">70%</p>
          </div>

          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Teacher Final Mark
          </label>

          <div className="mb-4 flex items-center gap-3">
            <input
              placeholder="14"
              className="w-24 rounded-2xl border border-slate-200 p-3 text-center font-bold outline-none"
            />
            <span className="font-semibold text-slate-600">/20</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button className="flex items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-white py-3 text-sm font-semibold text-blue-500">
              <Download size={17} />
              Save PDF
            </button>

            <button className="flex items-center justify-center gap-2 rounded-2xl bg-blue-500 py-3 text-sm font-semibold text-white">
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