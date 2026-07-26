import type { SubjectKey } from "@/lib/subjects/subjectConfig";

export type SubjectQuestionType = {
  label: string;
  paper: string;
  marks: number;
  assessmentLabel: string;
  opening: string;
  guidance: string;
};

export type SubjectQuestionPreset = {
  papers: { value: string; label: string }[];
  questionTypes: Record<string, SubjectQuestionType>;
};

export const subjectQuestionPresets: Record<
  SubjectKey,
  SubjectQuestionPreset
> = {
  "business-studies": {
    papers: [
      { value: "paper-1", label: "Paper 1" },
      { value: "paper-2", label: "Paper 2" },
    ],
    questionTypes: {
      define: {
        label: "Define – 2 marks",
        paper: "paper-1",
        marks: 2,
        assessmentLabel: "AO1",
        opening: "Define ",
        guidance: "Give a clear and accurate meaning of the business term.",
      },
      "identify-two": {
        label: "Identify two – 2 marks",
        paper: "paper-1",
        marks: 2,
        assessmentLabel: "AO1",
        opening: "Identify two ",
        guidance: "Give two separate answers.",
      },
      outline: {
        label: "Outline two – 4 marks",
        paper: "paper-1",
        marks: 4,
        assessmentLabel: "AO1, AO2",
        opening: "Outline two ",
        guidance: "Develop two points briefly in the supplied context.",
      },
      "explain-two": {
        label: "Explain two – 6 marks",
        paper: "paper-1",
        marks: 6,
        assessmentLabel: "AO1, AO2, AO3",
        opening: "Explain two ",
        guidance: "Develop two clear chains of reasoning.",
      },
      justify: {
        label: "Justify – 6 marks",
        paper: "paper-1",
        marks: 6,
        assessmentLabel: "AO2, AO3, AO4",
        opening: "Do you think ",
        guidance: "Make and support a contextual business judgement.",
      },
      "explain-context": {
        label: "Explain in context – 8 marks",
        paper: "paper-2",
        marks: 8,
        assessmentLabel: "AO1, AO2, AO3",
        opening: "Explain ",
        guidance: "Develop and apply points to the case-study business.",
      },
      "consider-justify": {
        label: "Consider and justify – 12 marks",
        paper: "paper-2",
        marks: 12,
        assessmentLabel: "AO2, AO3, AO4",
        opening: "Consider ",
        guidance: "Analyse options and reach a supported final judgement.",
      },
      recommend: {
        label: "Recommend and justify – 12 marks",
        paper: "paper-2",
        marks: 12,
        assessmentLabel: "AO2, AO3, AO4",
        opening: "Recommend ",
        guidance: "Compare the options and justify a recommendation.",
      },
    },
  },
  english: {
    papers: [
      { value: "reading", label: "Reading" },
      { value: "writing", label: "Writing" },
    ],
    questionTypes: {
      comprehension: {
        label: "Comprehension – 2 marks",
        paper: "reading",
        marks: 2,
        assessmentLabel: "Reading",
        opening: "Explain ",
        guidance: "Use relevant evidence from the extract.",
      },
      "language-analysis": {
        label: "Language analysis – 6 marks",
        paper: "reading",
        marks: 6,
        assessmentLabel: "Reading · Language",
        opening: "Analyse how ",
        guidance: "Select evidence and explain its meaning or effect.",
      },
      interpretation: {
        label: "Interpretation – 4 marks",
        paper: "reading",
        marks: 4,
        assessmentLabel: "Reading · Interpretation",
        opening: "What impression ",
        guidance: "Support the interpretation with textual evidence.",
      },
      "writing-task": {
        label: "Writing task – 10 marks",
        paper: "writing",
        marks: 10,
        assessmentLabel: "Writing",
        opening: "Write ",
        guidance: "Match purpose, audience, register and text structure.",
      },
    },
  },
  afrikaans: {
    papers: [
      { value: "lees-en-kyk", label: "Lees en Kyk" },
      { value: "skryf-en-aanbied", label: "Skryf en Aanbied" },
      { value: "taalstrukture", label: "Taalstrukture en Konvensies" },
    ],
    questionTypes: {
      begrip: {
        label: "Begrip – 2 punte",
        paper: "lees-en-kyk",
        marks: 2,
        assessmentLabel: "Lees en Kyk",
        opening: "Verduidelik ",
        guidance: "Gebruik toepaslike teksbewyse.",
      },
      "taal-en-toon": {
        label: "Taalgebruik en toon – 4 punte",
        paper: "lees-en-kyk",
        marks: 4,
        assessmentLabel: "Lees en Kyk",
        opening: "Bespreek ",
        guidance: "Verwys na taalgebruik, register of toon.",
      },
      skryf: {
        label: "Skryftaak – 10 punte",
        paper: "skryf-en-aanbied",
        marks: 10,
        assessmentLabel: "Skryf en Aanbied",
        opening: "Skryf ",
        guidance: "Let op inhoud, struktuur, register en taalgebruik.",
      },
      taalstrukture: {
        label: "Taalstrukture – 4 punte",
        paper: "taalstrukture",
        marks: 4,
        assessmentLabel: "Taalstrukture en Konvensies",
        opening: "Verbeter ",
        guidance: "Gebruik korrekte spelling, leestekens en woordorde.",
      },
    },
  },
  history: {
    papers: [
      { value: "paper-1", label: "Paper 1" },
      { value: "paper-2", label: "Paper 2 · Sources" },
    ],
    questionTypes: {
      "describe-four": {
        label: "Describe – 4 marks",
        paper: "paper-1",
        marks: 4,
        assessmentLabel: "Knowledge",
        opening: "Describe ",
        guidance: "Give relevant, accurate historical detail.",
      },
      "explain-six": {
        label: "Explain – 6 marks",
        paper: "paper-1",
        marks: 6,
        assessmentLabel: "Explanation",
        opening: "Why ",
        guidance: "Develop explained reasons using historical evidence.",
      },
      "evaluate-ten": {
        label: "Evaluate – 10 marks",
        paper: "paper-1",
        marks: 10,
        assessmentLabel: "Evaluation",
        opening: "How far do you agree ",
        guidance: "Explain both sides and reach a balanced judgement.",
      },
      "source-comparison": {
        label: "Compare sources – 6 marks",
        paper: "paper-2",
        marks: 6,
        assessmentLabel: "Source comparison",
        opening: "How similar are ",
        guidance: "Compare source content and support both sides with evidence.",
      },
      "source-evaluation": {
        label: "Evaluate a source – 8 marks",
        paper: "paper-2",
        marks: 8,
        assessmentLabel: "Source evaluation",
        opening: "How useful is ",
        guidance: "Evaluate content, provenance and contextual knowledge.",
      },
    },
  },
};
