"use client";

import { useEffect, useState } from "react";
import { Minus, Plus, Shield } from "lucide-react";
const questionTypeDetails: Record<
  string,
  {
  marks: number;
  ao: string;
  opening: string;
  guidance: string;
}
> = {
  define: {
  marks: 2,
  ao: "AO1",
  opening: "Define ",
  guidance:
    "Give a clear and accurate meaning of the business term. Include the key features needed for a complete definition.",
},
  "identify-two": {
  marks: 2,
  ao: "AO1",
  opening: "Identify two ",
  guidance:
    "Give two separate answers. No explanation is required unless the question asks for it.",
},
  outline: {
  marks: 4,
  ao: "AO1, AO2",
  opening: "Outline two ",
  guidance:
    "Give two separate points. Develop each point briefly in relation to the business or context provided.",
},
  "explain-two": {
  marks: 6,
  ao: "AO1, AO2, AO3",
  opening: "Explain two ",
  guidance:
    "Give two separate points. Explain each one using a clear chain of reasoning and apply it to the business where possible.",
},
  justify: {
  marks: 6,
  ao: "AO2, AO3, AO4",
  opening: "Do you think ",
  guidance:
    "Make a clear judgement. Support it with developed business reasoning, consider relevant alternatives, and explain why your choice is the best one.",
},
  "explain-context": {
  marks: 8,
  ao: "AO1, AO2, AO3",
  opening: "Explain ",
  guidance:
    "Give four separate points. Explain each one clearly and apply each point to the case-study business.",
},
  "consider-justify": {
  marks: 12,
  ao: "AO2, AO3, AO4",
  opening: "Consider ",
  guidance:
    "Analyse the relevant options using the case-study information. Consider advantages and disadvantages, then make and justify a clear final judgement.",
},
  recommend: {
  marks: 12,
  ao: "AO2, AO3, AO4",
  opening: "Recommend ",
  guidance:
    "Compare the available options in context. Develop both sides of the argument, make a clear recommendation, and explain why it is the best choice for this business.",
},
};
export type ActivityQuestion = {
  id: number;
  paper: string;
  questionType: string;
  questionText: string;
  marks: string;
  ao: string;
  guidance: string;
  isGenerating: boolean;
  hasGeneratedQuestion: boolean;
};
type ActivityQuestionBuilderProps = {
  onTotalMarksChange?: (total: number) => void;
  onQuestionsChange?: (questions: ActivityQuestion[]) => void;
  generatedQuestions?: {
    id: number;
    questionText: string;
  }[];
  resetKey?: number;
};

export default function ActivityQuestionBuilder({
  onTotalMarksChange,
  onQuestionsChange,
  generatedQuestions = [],
  resetKey = 0,
}: ActivityQuestionBuilderProps) {
  const [questions, setQuestions] = useState<ActivityQuestion[]>([
  {
  id: 1,
  paper: "paper-1",
  questionType: "",
  questionText: "",
  marks: "",
  ao: "",
  guidance: "",
  isGenerating: false,
hasGeneratedQuestion: false,
},
]);
const totalMarks = questions.reduce(
  (total, question) => total + Number(question.marks || 0),
  0
);

useEffect(() => {
  onTotalMarksChange?.(totalMarks);
}, [totalMarks, onTotalMarksChange]);

useEffect(() => {
  onQuestionsChange?.(questions);
}, [questions, onQuestionsChange]);


useEffect(() => {
  if (generatedQuestions.length === 0) return;

  setQuestions((currentQuestions) =>
    currentQuestions.map((currentQuestion) => {
      const generatedQuestion = generatedQuestions.find(
        (item) => item.id === currentQuestion.id
      );

      return generatedQuestion
        ? {
            ...currentQuestion,
            questionText: generatedQuestion.questionText,
          }
        : currentQuestion;
    })
  );
}, [generatedQuestions]);

useEffect(() => {
  setQuestions([
    {
      id: 1,
      paper: "paper-1",
      questionType: "",
      questionText: "",
      marks: "",
      ao: "",
      guidance: "",
      isGenerating: false,
      hasGeneratedQuestion: false,
    },
  ]);
}, [resetKey]);
return (
  
    <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
  <h3 className="text-lg font-bold text-slate-900">
    Activity Questions
  </h3>

  <div className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm">
    Total Marks: {totalMarks}
  </div>
</div>

      {questions.map((question, index) => (
  <div
    key={question.id}
    className="mb-4 rounded-2xl bg-white p-4 shadow-sm"
  >
    <div className="mb-3 flex items-center justify-between gap-3">
  <p className="font-semibold text-slate-800">
    Question {index + 1}
  </p>

  {questions.length > 1 && (
    <button
      type="button"
      onClick={() =>
        setQuestions((currentQuestions) =>
          currentQuestions.filter((_, questionIndex) => questionIndex !== index)
        )
      }
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-red-500 hover:bg-red-50"
      aria-label={`Remove question ${index + 1}`}
    >
      <Minus size={16} />
      <span>Remove</span>
    </button>
  )}
</div>
<div className="mb-3 grid min-w-0 gap-3 sm:grid-cols-2">
  <select
    value={question.paper}
    onChange={(event) =>
      setQuestions((currentQuestions) =>
        currentQuestions.map((currentQuestion) =>
          currentQuestion.id === question.id
            ? {
                ...currentQuestion,
                paper: event.target.value,
                questionType: "",
              }
            : currentQuestion
        )
      )
    }
    className="min-w-0 w-full rounded-xl border border-slate-200 bg-white p-3 outline-none"
  >
    <option value="paper-1">Paper 1</option>
    <option value="paper-2">Paper 2</option>
  </select>

  <select
    value={question.questionType}
    onChange={(event) => {
  const selectedType = event.target.value;
  const details = questionTypeDetails[selectedType];

  setQuestions((currentQuestions) =>
    currentQuestions.map((currentQuestion) =>
      currentQuestion.id === question.id
        ? {
            ...currentQuestion,
            questionType: selectedType,
            marks: details ? String(details.marks) : "",
            ao: details?.ao ?? "",
guidance: details?.guidance ?? "",
questionText:
  details && !currentQuestion.questionText
    ? details.opening
    : currentQuestion.questionText,
          }
        : currentQuestion
    )
  );
}}
    className="min-w-0 w-full rounded-xl border border-slate-200 bg-white p-3 outline-none"
  >
    <option value="">Select question type</option>

    {question.paper === "paper-1" ? (
      <>
        <option value="define">Define – 2 marks</option>
        <option value="identify-two">Identify two – 2 marks</option>
        <option value="outline">Outline two – 4 marks</option>
        <option value="explain-two">Explain two – 6 marks</option>
        <option value="justify">Justify – 6 marks</option>
      </>
    ) : (
      <>
        <option value="explain-context">
          Explain in context – 8 marks
        </option>
        <option value="consider-justify">
          Consider and justify – 12 marks
        </option>
        <option value="recommend">
          Recommend and justify – 12 marks
        </option>
      </>
    )}
  </select>
</div>

    <textarea
  value={question.questionText ?? ""}
  onChange={(event) =>
    setQuestions((currentQuestions) =>
      currentQuestions.map((currentQuestion) =>
        currentQuestion.id === question.id
          ? {
              ...currentQuestion,
              questionText: event.target.value,
            }
          : currentQuestion
      )
    )
  }
  placeholder="Write your own question or click Ask Kingdom..."
 className="mb-3 w-full rounded-xl border border-slate-200 p-3 font-semibold text-slate-900 outline-none"
  rows={4}
/>

    <div className="grid grid-cols-2 gap-3">
  <input
    value={question.marks ?? ""}
    readOnly
    placeholder="Marks"
    className="rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
  />

  <input
    value={question.ao ?? ""}
    readOnly
    placeholder="AO"
    className="rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none"
  />
</div>
<textarea
  value={question.guidance ?? ""}
  onChange={(event) =>
    setQuestions((currentQuestions) =>
      currentQuestions.map((currentQuestion) =>
        currentQuestion.id === question.id
          ? {
              ...currentQuestion,
              guidance: event.target.value,
            }
          : currentQuestion
      )
    )
  }
  placeholder="Guidance (optional)"
  rows={4}
  className="mt-3 min-h-28 w-full resize-y rounded-xl border border-slate-200 p-3 outline-none"
/>
  </div>
))}

<button
  type="button"
  onClick={() =>
  setQuestions((currentQuestions) => [
    ...currentQuestions,
    {
  id: Date.now(),
  paper: "paper-1",
  questionType: "",
  questionText: "",
  marks: "",
  ao: "",
  guidance: "",
  isGenerating: false,
hasGeneratedQuestion: false,
},
  ])
}
  className="inline-flex cursor-pointer touch-manipulation select-none items-center justify-center gap-2 rounded-xl border border-dashed border-orange-300 px-5 py-3 font-semibold text-orange-600 hover:bg-orange-100"
>
  <Plus size={18} />
  <span>Add Question</span>
</button>
    </div>
  );
}