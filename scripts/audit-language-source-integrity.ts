import type { SubjectKey } from "../lib/subjects/subjectConfig";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  auditLanguageActivity,
  summarizeLanguageAudit,
} from "../lib/subjects/languageSourceAudit";
import {
  getSubjectConfiguration,
} from "../lib/subjects/subjectConfig";

const rootDir = process.cwd();
const envFiles = [".env.local", ".env"];

for (const fileName of envFiles) {
  const filePath = path.join(rootDir, fileName);
  if (!fs.existsSync(filePath)) continue;

  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    if (!key || process.env[key]) continue;

    const value = rawValue.replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const SUBJECT_KEYS: SubjectKey[] = [
  "english",
  "english-stage-8",
  "afrikaans",
  "afrikaans-stage-8",
];

type LessonRow = {
  id: string;
  title: string;
  subject_id: string;
  lesson_number: string | null;
  status: string;
  created_at: string;
};

type LessonMaterialRow = {
  id: string;
  lesson_id: string;
  material_type: string;
  content_text?: string | null;
  display_order: number | null;
};

type ActivityRow = {
  id: string;
  title: string;
  lesson_material_id: string;
  created_at: string;
};

type ActivityQuestionRow = {
  id: string;
  activity_id: string;
  question_number: number | null;
  display_order: number | null;
  question_text: string;
  question_type: string | null;
  guidance: string | null;
};

type AuditDiagnostics = {
  totalLessonsInDatabase: number;
  languageLessonsFound: number;
  lessonStatusCounts: Record<string, number>;
  languageLessonCountsBySubject: Record<string, number>;
  languageLessonMaterialCountsByType: Record<string, number>;
  linkedActivityCountsByMaterialType: Record<string, number>;
  linkedActivitiesFound: number;
  linkedActivityQuestionsFound: number;
};

function getStageLabel(subjectKey: SubjectKey) {
  const subject = getSubjectConfiguration(subjectKey);
  return subject.defaultStageOrGrade;
}

function formatCounts(label: string, count: number) {
  return `${label.padEnd(28, ".")} ${String(count).padStart(4, " ")}`;
}

function buildTimestamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function incrementCount(record: Record<string, number>, key: string) {
  record[key] = (record[key] ?? 0) + 1;
}

function inferQuestionIndex(question: { question_number: number | null; display_order: number | null }) {
  if (typeof question.question_number === "number") {
    return question.question_number;
  }

  if (typeof question.display_order === "number") {
    return question.display_order;
  }

  return 0;
}

async function loadLessonsBySubject(subjectIds: string[]) {
  const { data, error } = await supabase
    .from("lessons")
    .select("id, title, subject_id, lesson_number, status, created_at")
    .in("subject_id", subjectIds)
    .eq("status", "published")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as LessonRow[];
}

async function loadLessonMaterials(lessonIds: string[]) {
  if (lessonIds.length === 0) return [];

  const { data, error } = await supabase
    .from("lesson_materials")
    .select("id, lesson_id, material_type, content_text, display_order")
    .in("lesson_id", lessonIds)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as LessonMaterialRow[];
}

async function loadActivities(activityMaterialIds: string[]) {
  if (activityMaterialIds.length === 0) return [];

  const { data, error } = await supabase
    .from("activities")
    .select("id, title, lesson_material_id, created_at")
    .in("lesson_material_id", activityMaterialIds)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ActivityRow[];
}

async function loadActivityQuestions(activityIds: string[]) {
  if (activityIds.length === 0) return [];

  const { data, error } = await supabase
    .from("activity_questions")
    .select(
      "id, activity_id, question_number, display_order, question_text, question_type, guidance",
    )
    .in("activity_id", activityIds)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("question_number", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ActivityQuestionRow[];
}

async function loadLessonStatusSample() {
  const { data, error } = await supabase
    .from("lessons")
    .select("status")
    .limit(5000);

  if (error) throw error;
  return data ?? [];
}

async function loadLessonCount() {
  const { count, error } = await supabase
    .from("lessons")
    .select("id", { head: true, count: "exact" });

  if (error) throw error;
  return count ?? 0;
}

async function runAudit() {
  const subjectConfigurations = SUBJECT_KEYS.map((subjectKey) => ({
    subjectKey,
    configuration: getSubjectConfiguration(subjectKey),
  }));

  const subjectIds = subjectConfigurations.map((subject) => subject.configuration.databaseId);
  const [totalLessonsInDatabase, lessonStatusRows, lessons] = await Promise.all([
    loadLessonCount(),
    loadLessonStatusSample(),
    loadLessonsBySubject(subjectIds),
  ]);

  const lessonIds = lessons.map((lesson) => lesson.id);
  const lessonMaterials = await loadLessonMaterials(lessonIds);
  const activities = await loadActivities(lessonMaterials.map((item) => item.id));
  const activityQuestions = await loadActivityQuestions(activities.map((activity) => activity.id));

  const subjectById = new Map<string, (typeof subjectConfigurations)[number]>(
    subjectConfigurations.map((subject) => [subject.configuration.databaseId, subject]),
  );
  const readingByLessonId = new Map(
    lessonMaterials
      .filter((material) => material.material_type === "reading")
      .map((material) => [material.lesson_id, material]),
  );
  const materialById = new Map(
    lessonMaterials.map((material) => [material.id, material]),
  );
  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const questionsByActivityId = new Map<string, ActivityQuestionRow[]>();

  for (const question of activityQuestions) {
    questionsByActivityId.set(question.activity_id, [
      ...(questionsByActivityId.get(question.activity_id) ?? []),
      question,
    ]);
  }

  const diagnostics: AuditDiagnostics = {
    totalLessonsInDatabase,
    languageLessonsFound: lessons.length,
    lessonStatusCounts: {},
    languageLessonCountsBySubject: {},
    languageLessonMaterialCountsByType: {},
    linkedActivityCountsByMaterialType: {},
    linkedActivitiesFound: activities.length,
    linkedActivityQuestionsFound: activityQuestions.length,
  };

  for (const row of lessonStatusRows) {
    incrementCount(diagnostics.lessonStatusCounts, row.status ?? "null");
  }

  for (const lesson of lessons) {
    const subject = subjectById.get(lesson.subject_id);
    incrementCount(
      diagnostics.languageLessonCountsBySubject,
      subject?.configuration.displayName ?? lesson.subject_id,
    );
  }

  for (const material of lessonMaterials) {
    incrementCount(diagnostics.languageLessonMaterialCountsByType, material.material_type);
  }

  for (const activity of activities) {
    const materialType = materialById.get(activity.lesson_material_id)?.material_type ?? "missing-material";
    incrementCount(diagnostics.linkedActivityCountsByMaterialType, materialType);
  }

  const results: Awaited<ReturnType<typeof auditLanguageActivity>>[] = [];

  for (const activity of activities) {
    const linkedMaterial = materialById.get(activity.lesson_material_id);
    if (!linkedMaterial) continue;

    const lesson = lessonById.get(linkedMaterial.lesson_id);
    if (!lesson) continue;

    const subject = subjectById.get(lesson.subject_id);
    if (!subject) continue;

    const readingMaterial = readingByLessonId.get(lesson.id);
    const readingContent = typeof readingMaterial?.content_text === "string"
      ? readingMaterial.content_text
      : "";

    const questionRows = questionsByActivityId.get(activity.id) ?? [];

    results.push(
      auditLanguageActivity({
        subjectKey: subject.subjectKey,
        subjectLabel: subject.configuration.displayName,
        stageLabel: getStageLabel(subject.subjectKey),
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        activityId: activity.id,
        activityTitle: activity.title,
        readingContent,
        questions: questionRows.map((question) => ({
          questionId: question.id,
          questionIndex: inferQuestionIndex(question),
          questionText: question.question_text,
          questionType: question.question_type,
          guidance: question.guidance,
        })),
      }),
    );
  }

  return { results, diagnostics };
}

function printDiagnostics(diagnostics: AuditDiagnostics) {
  console.log("Diagnostics");
  console.log(formatCounts("Total lessons", diagnostics.totalLessonsInDatabase));
  console.log(formatCounts("Language lessons found", diagnostics.languageLessonsFound));
  console.log(formatCounts("Linked activities found", diagnostics.linkedActivitiesFound));
  console.log(formatCounts("Linked questions found", diagnostics.linkedActivityQuestionsFound));
  console.log("");

  console.log("Lesson statuses observed");
  for (const [status, count] of Object.entries(diagnostics.lessonStatusCounts)) {
    console.log(`  ${formatCounts(status, count)}`);
  }
  console.log("");

  console.log("Language lessons by subject");
  for (const [subject, count] of Object.entries(diagnostics.languageLessonCountsBySubject)) {
    console.log(`  ${subject}: ${count}`);
  }
  console.log("");

  console.log("Language lesson materials by type");
  for (const [type, count] of Object.entries(diagnostics.languageLessonMaterialCountsByType)) {
    console.log(`  ${type}: ${count}`);
  }
  console.log("");

  console.log("Linked activities by material type");
  for (const [type, count] of Object.entries(diagnostics.linkedActivityCountsByMaterialType)) {
    console.log(`  ${type}: ${count}`);
  }
  console.log("");
}

function printSummary(results: Awaited<ReturnType<typeof runAudit>>["results"]) {
  const summary = summarizeLanguageAudit(results);

  console.log("---------------------------------------");
  console.log("");
  console.log("AD Astra Language Source-Integrity Audit");
  console.log("");
  console.log(formatCounts("Activities scanned", summary.totalActivitiesScanned));
  console.log(formatCounts("Questions scanned", summary.totalQuestionsScanned));
  console.log(formatCounts("OK", summary.totalOk));
  console.log(formatCounts("WARNING", summary.totalWarning));
  console.log(formatCounts("FAIL", summary.totalFail));
  console.log("");

  for (const [subject, counts] of Object.entries(summary.bySubject)) {
    console.log(subject);
    console.log(`  ${formatCounts("OK", counts.OK)}`);
    console.log(`  ${formatCounts("WARNING", counts.WARNING)}`);
    console.log(`  ${formatCounts("FAIL", counts.FAIL)}`);
  }

  console.log("");
  console.log("Sample flagged items:");

  const flagged = results
    .flatMap((result) =>
      result.questions
        .filter((question) => question.integrityStatus !== "OK")
        .map((question) => ({ result, question })),
    )
    .slice(0, 10);

  if (flagged.length === 0) {
    console.log("  None");
  } else {
    for (const item of flagged) {
      console.log(
        `  [${item.question.integrityStatus}] ${item.result.subjectLabel} | ${item.result.lessonTitle} | ${item.result.activityTitle} | Q${item.question.questionIndex || "?"} | ${item.question.reason}`,
      );
    }
  }

  console.log("");
  console.log("---------------------------------------");

  return summary;
}

async function main() {
  const { results, diagnostics } = await runAudit();
  console.log("---------------------------------------");
  console.log("");
  printDiagnostics(diagnostics);
  const summary = printSummary(results);

  const reportsDirectory = path.join(rootDir, "reports");
  fs.mkdirSync(reportsDirectory, { recursive: true });
  const timestamp = buildTimestamp();
  const outputPath = path.join(
    reportsDirectory,
    `language-source-integrity-audit-${timestamp}.json`,
  );

  fs.writeFileSync(
    outputPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), diagnostics, summary, results }, null, 2),
    "utf8",
  );

  console.log(`JSON report written to ${outputPath}`);
}

main().catch((error) => {
  console.error("Language source-integrity audit failed:", error);
  process.exit(1);
});