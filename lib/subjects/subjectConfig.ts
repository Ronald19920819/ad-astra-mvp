export type SubjectColourTheme = {
  primary: string;
  softBackground: string;
  border: string;
};

export type SubjectConfiguration = {
  key: "business-studies" | "english" | "afrikaans" | "history";
  displayName: string;
  slug: string;
  databaseId: string;
  colourTheme: SubjectColourTheme;
  iconKey: "bar-chart" | "book-open" | "languages" | "scroll-text";
  framework: string;
  defaultStageOrGrade: string;
  assessmentStyle: string;
  questionConventions: readonly string[];
  readingConventions: readonly string[];
  teacherPreferences: Readonly<Record<string, string | boolean>>;
  routes: {
    learnerDashboard: string;
    learnerClassroom: string;
    learnerActivities: string;
    teacherOverview: string;
    teacherClassroom: string;
    teacherActivities: string;
    teacherReview: string;
    teacherTracker: string;
    teacherLearners: string;
  };
  rolloutStatus: "reference" | "active";
};

export const subjectConfigurations = {
  "business-studies": {
    key: "business-studies",
    displayName: "Business Studies",
    slug: "business-studies",
    databaseId: "c472f3c9-0e6f-40de-a748-3ad9400ac069",
    colourTheme: {
      primary: "#F97316",
      softBackground: "#FFF3E6",
      border: "#FFEDD5",
    },
    iconKey: "bar-chart",
    framework: "Cambridge IGCSE",
    defaultStageOrGrade: "Cambridge IGCSE",
    assessmentStyle: "Business Studies assessment-objective based",
    questionConventions: [
      "Use Cambridge Business Studies command words.",
      "Respect AO labels and mark allocations.",
    ],
    readingConventions: [
      "Use clear textbook-style explanations.",
      "Include supported business examples where useful.",
    ],
    teacherPreferences: {
      useCambridgeCommandWords: true,
      showAssessmentObjectiveLabels: true,
    },
    routes: {
      learnerDashboard: "/business-studies-dashboard",
      learnerClassroom: "/business-studies-classroom",
      learnerActivities: "/business-studies-activities",
      teacherOverview: "/teacher/subjects/business-studies",
      teacherClassroom: "/teacher/subjects/business-studies/classroom",
      teacherActivities: "/teacher/subjects/business-studies/activities",
      teacherReview: "/teacher/subjects/business-studies/review",
      teacherTracker: "/teacher/subjects/business-studies/tracker",
      teacherLearners: "/teacher/subjects/business-studies/learners",
    },
    rolloutStatus: "reference",
  },
  english: {
    key: "english",
    displayName: "English",
    slug: "english",
    databaseId: "0d0f5c7f-23c6-4022-a5c3-f6e1c779b681",
    colourTheme: {
      primary: "#2563EB",
      softBackground: "#EEF5FF",
      border: "#DBEAFE",
    },
    iconKey: "book-open",
    framework: "Cambridge Lower Secondary",
    defaultStageOrGrade: "Stage 9",
    assessmentStyle: "Cambridge Reading and Writing strands",
    questionConventions: [
      "Use Cambridge Reading and Writing strands where relevant.",
      "Use evidence from extracts for reading questions.",
      "Apply skill tags and clear mark allocations when requested.",
      "Assess language, grammar, punctuation, text structure, interpretation, creation, appreciation and reflection as appropriate.",
    ],
    readingConventions: [
      "Use age-appropriate English extracts and models.",
      "Support reading analysis and the creation of texts where relevant.",
    ],
    teacherPreferences: {
      readingBeforeQuestions: true,
      useCambridgeStyleQuestions: true,
      showSkillTags: true,
      showMarkAllocations: true,
    },
    routes: {
      learnerDashboard: "/english-dashboard",
      learnerClassroom: "/english-classroom",
      learnerActivities: "/english-activities",
      teacherOverview: "/teacher/subjects/english",
      teacherClassroom: "/teacher/subjects/english/classroom",
      teacherActivities: "/teacher/subjects/english/activities",
      teacherReview: "/teacher/subjects/english/review",
      teacherTracker: "/teacher/subjects/english/tracker",
      teacherLearners: "/teacher/subjects/english/learners",
    },
    rolloutStatus: "active",
  },
  afrikaans: {
    key: "afrikaans",
    displayName: "Afrikaans",
    slug: "afrikaans",
    databaseId: "e26c1112-3627-4a56-8f6a-4eab5d209b23",
    colourTheme: {
      primary: "#EB2525",
      softBackground: "#FFF1F1",
      border: "#FEE2E2",
    },
    iconKey: "languages",
    framework: "CAPS",
    defaultStageOrGrade: "Grade 9",
    assessmentStyle: "CAPS strands",
    questionConventions: [
      "Use CAPS terminology: Lees en Kyk, Skryf en Aanbied, and Taalstrukture en Konvensies.",
      "Assess begrip, taalgebruik, spelling, leestekens, woordorde, register, toon, inhoud and struktuur as appropriate.",
      "Provide clear answer instructions and mark allocations.",
    ],
    readingConventions: [
      "Produce Afrikaans-language output unless the teacher explicitly requests another language.",
      "Use CAPS-aligned terminology and age-appropriate Afrikaans.",
    ],
    teacherPreferences: {
      outputLanguage: "Afrikaans",
      useCapsTerminology: true,
      showMarkAllocations: true,
    },
    routes: {
      learnerDashboard: "/afrikaans-dashboard",
      learnerClassroom: "/afrikaans-classroom",
      learnerActivities: "/afrikaans-activities",
      teacherOverview: "/teacher/subjects/afrikaans",
      teacherClassroom: "/teacher/subjects/afrikaans/classroom",
      teacherActivities: "/teacher/subjects/afrikaans/activities",
      teacherReview: "/teacher/subjects/afrikaans/review",
      teacherTracker: "/teacher/subjects/afrikaans/tracker",
      teacherLearners: "/teacher/subjects/afrikaans/learners",
    },
    rolloutStatus: "active",
  },
  history: {
    key: "history",
    displayName: "History",
    slug: "history",
    databaseId: "dca2600c-932f-46bf-904c-a99be158e7f0",
    colourTheme: {
      primary: "#3AAA35",
      softBackground: "#EEFBEA",
      border: "#DCFCE7",
    },
    iconKey: "scroll-text",
    framework: "Cambridge IGCSE 0470",
    defaultStageOrGrade: "Cambridge IGCSE",
    assessmentStyle: "Cambridge History levels",
    questionConventions: [
      "Use Cambridge IGCSE History 0470 Paper 1 and Paper 2 conventions.",
      "Support source-based questions and 4-, 6- and 10-mark structures where requested.",
      "Match explanation, comparison, evaluation and balanced judgement to the command word.",
      "Use historical evidence and level-based marking where appropriate.",
      "Do not reduce explanation or evaluation questions to simple fact recall.",
    ],
    readingConventions: [
      "Distinguish clearly between evidence, interpretation and judgement.",
      "Present chronology and historical context accurately.",
    ],
    teacherPreferences: {
      useCoreContent: true,
      supportDepthStudy: true,
      useSourceHandling: true,
      useLevelDescriptors: true,
      useCommandWords: true,
    },
    routes: {
      learnerDashboard: "/history-dashboard",
      learnerClassroom: "/history-classroom",
      learnerActivities: "/history-activities",
      teacherOverview: "/teacher/subjects/history",
      teacherClassroom: "/teacher/subjects/history/classroom",
      teacherActivities: "/teacher/subjects/history/activities",
      teacherReview: "/teacher/subjects/history/review",
      teacherTracker: "/teacher/subjects/history/tracker",
      teacherLearners: "/teacher/subjects/history/learners",
    },
    rolloutStatus: "active",
  },
} as const satisfies Record<string, SubjectConfiguration>;

export type SubjectKey = keyof typeof subjectConfigurations;

export function getSubjectConfiguration(subjectKey: SubjectKey) {
  return subjectConfigurations[subjectKey];
}

export function isSubjectKey(value: string): value is SubjectKey {
  return value in subjectConfigurations;
}

export function getSubjectConfigurationByDatabaseId(subjectId: string) {
  return Object.values(subjectConfigurations).find(
    (subject) => subject.databaseId === subjectId,
  );
}

export const businessStudiesSubject =
  subjectConfigurations["business-studies"];
