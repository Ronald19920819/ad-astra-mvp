export type SubjectColourTheme = {
  primary: string;
  softBackground: string;
  border: string;
};

export type SubjectFamilyKey =
  | "business-studies"
  | "english"
  | "afrikaans"
  | "history";

export type SubjectConfiguration = {
  key:
    | "business-studies"
    | "business-studies-igcse-1"
    | "english"
    | "english-stage-8"
    | "afrikaans"
    | "afrikaans-stage-8"
    | "history"
    | "history-igcse-1";
  familyKey: SubjectFamilyKey;
  displayName: string;
  slug: string;
  code: string;
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
    learnerLiveClassroom: string;
    learnerClassroom: string;
    learnerActivities: string;
    teacherOverview: string;
    teacherLiveClassroom: string;
    teacherClassroom: string;
    teacherActivities: string;
    teacherReview: string;
    teacherTracker: string;
    teacherLearners: string;
  };
  rolloutStatus: "reference" | "active";
};

const subjectRouteBases = {
  "business-studies": {
    learnerDashboard: "/business-studies-dashboard",
    learnerLiveClassroom: "/business-studies-live-classroom",
    learnerClassroom: "/business-studies-classroom",
    learnerActivities: "/business-studies-activities",
    teacherOverview: "/teacher/subjects/business-studies",
    teacherLiveClassroom: "/teacher/subjects/business-studies/live-classroom",
    teacherClassroom: "/teacher/subjects/business-studies/classroom",
    teacherActivities: "/teacher/subjects/business-studies/activities",
    teacherReview: "/teacher/subjects/business-studies/review",
    teacherTracker: "/teacher/subjects/business-studies/tracker",
    teacherLearners: "/teacher/subjects/business-studies/learners",
  },
  english: {
    learnerDashboard: "/english-dashboard",
    learnerLiveClassroom: "/english-live-classroom",
    learnerClassroom: "/english-classroom",
    learnerActivities: "/english-activities",
    teacherOverview: "/teacher/subjects/english",
    teacherLiveClassroom: "/teacher/subjects/english/live-classroom",
    teacherClassroom: "/teacher/subjects/english/classroom",
    teacherActivities: "/teacher/subjects/english/activities",
    teacherReview: "/teacher/subjects/english/review",
    teacherTracker: "/teacher/subjects/english/tracker",
    teacherLearners: "/teacher/subjects/english/learners",
  },
  afrikaans: {
    learnerDashboard: "/afrikaans-dashboard",
    learnerLiveClassroom: "/afrikaans-live-classroom",
    learnerClassroom: "/afrikaans-classroom",
    learnerActivities: "/afrikaans-activities",
    teacherOverview: "/teacher/subjects/afrikaans",
    teacherLiveClassroom: "/teacher/subjects/afrikaans/live-classroom",
    teacherClassroom: "/teacher/subjects/afrikaans/classroom",
    teacherActivities: "/teacher/subjects/afrikaans/activities",
    teacherReview: "/teacher/subjects/afrikaans/review",
    teacherTracker: "/teacher/subjects/afrikaans/tracker",
    teacherLearners: "/teacher/subjects/afrikaans/learners",
  },
  history: {
    learnerDashboard: "/history-dashboard",
    learnerLiveClassroom: "/history-live-classroom",
    learnerClassroom: "/history-classroom",
    learnerActivities: "/history-activities",
    teacherOverview: "/teacher/subjects/history",
    teacherLiveClassroom: "/teacher/subjects/history/live-classroom",
    teacherClassroom: "/teacher/subjects/history/classroom",
    teacherActivities: "/teacher/subjects/history/activities",
    teacherReview: "/teacher/subjects/history/review",
    teacherTracker: "/teacher/subjects/history/tracker",
    teacherLearners: "/teacher/subjects/history/learners",
  },
} as const satisfies Record<
  SubjectFamilyKey,
  SubjectConfiguration["routes"]
>;

export const subjectConfigurations = {
  "business-studies": {
    key: "business-studies",
    familyKey: "business-studies",
    displayName: "Business Studies 0450 - IGCSE 2",
    slug: "business-studies-0450-igcse-2",
    code: "BS0450-IG2",
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
    routes: subjectRouteBases["business-studies"],
    rolloutStatus: "reference",
  },
  "business-studies-igcse-1": {
    key: "business-studies-igcse-1",
    familyKey: "business-studies",
    displayName: "Business Studies 0450 - IGCSE 1",
    slug: "business-studies-0450-igcse-1",
    code: "BS0450-IG1",
    databaseId: "7d6c9b24-7d9a-4f8b-9c4c-7f6d1e3a0b11",
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
    routes: subjectRouteBases["business-studies"],
    rolloutStatus: "reference",
  },
  english: {
    key: "english",
    familyKey: "english",
    displayName: "English 0861 - Stage 9",
    slug: "english-0861-stage-9",
    code: "ENG0861-S9",
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
    routes: subjectRouteBases.english,
    rolloutStatus: "active",
  },
  "english-stage-8": {
    key: "english-stage-8",
    familyKey: "english",
    displayName: "English 0861 - Stage 8",
    slug: "english-0861-stage-8",
    code: "ENG0861-S8",
    databaseId: "9f2a6c13-3d7e-4f1b-8c55-4b8c7d6e2f33",
    colourTheme: {
      primary: "#2563EB",
      softBackground: "#EEF5FF",
      border: "#DBEAFE",
    },
    iconKey: "book-open",
    framework: "Cambridge Lower Secondary",
    defaultStageOrGrade: "Stage 8",
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
    routes: subjectRouteBases.english,
    rolloutStatus: "active",
  },
  afrikaans: {
    key: "afrikaans",
    familyKey: "afrikaans",
    displayName: "Afrikaans - Stage 9",
    slug: "afrikaans-stage-9",
    code: "AFR-S9",
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
    routes: subjectRouteBases.afrikaans,
    rolloutStatus: "active",
  },
  "afrikaans-stage-8": {
    key: "afrikaans-stage-8",
    familyKey: "afrikaans",
    displayName: "Afrikaans - Stage 8",
    slug: "afrikaans-stage-8",
    code: "AFR-S8",
    databaseId: "a03b7d24-4e8f-4a2c-9d66-5c9d8e7f3044",
    colourTheme: {
      primary: "#EB2525",
      softBackground: "#FFF1F1",
      border: "#FEE2E2",
    },
    iconKey: "languages",
    framework: "CAPS",
    defaultStageOrGrade: "Grade 8",
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
    routes: subjectRouteBases.afrikaans,
    rolloutStatus: "active",
  },
  history: {
    key: "history",
    familyKey: "history",
    displayName: "History 0470 - IGCSE 2",
    slug: "history-0470-igcse-2",
    code: "HIS0470-IG2",
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
    routes: subjectRouteBases.history,
    rolloutStatus: "active",
  },
  "history-igcse-1": {
    key: "history-igcse-1",
    familyKey: "history",
    displayName: "History 0470 - IGCSE 1",
    slug: "history-0470-igcse-1",
    code: "HIS0470-IG1",
    databaseId: "8e1f5b92-2b6c-4e0c-9d44-3a7b6c5d1e22",
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
    routes: subjectRouteBases.history,
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

export function getSubjectConfigurationsForFamily(
  familyKey: SubjectFamilyKey,
) {
  return Object.values(subjectConfigurations).filter(
    (subject) => subject.familyKey === familyKey,
  );
}

export function getCanonicalSubjectConfiguration(
  familyKey: SubjectFamilyKey,
) {
  return Object.values(subjectConfigurations).find(
    (subject) => subject.familyKey === familyKey && subject.key === familyKey,
  )!;
}

export function buildSubjectRoute(
  subject: Pick<SubjectConfiguration, "databaseId" | "routes">,
  routeKey: keyof SubjectConfiguration["routes"],
) {
  return `${subject.routes[routeKey]}?subject=${encodeURIComponent(
    subject.databaseId,
  )}`;
}

export function buildSubjectDetailRoute(
  subject: Pick<SubjectConfiguration, "databaseId" | "routes">,
  routeKey: "learnerClassroom" | "learnerActivities" | "teacherReview",
  detailId: string,
) {
  return `${subject.routes[routeKey]}/${detailId}?subject=${encodeURIComponent(
    subject.databaseId,
  )}`;
}

export function resolveSubjectConfigurationForFamily(
  familyKey: SubjectFamilyKey,
  selectedSubjectId?: string | null,
) {
  if (selectedSubjectId) {
    const selectedSubject = getSubjectConfigurationByDatabaseId(
      selectedSubjectId,
    );
    if (selectedSubject && selectedSubject.familyKey === familyKey) {
      return selectedSubject;
    }
  }

  return getCanonicalSubjectConfiguration(familyKey);
}

export const businessStudiesSubject =
  subjectConfigurations["business-studies"];
