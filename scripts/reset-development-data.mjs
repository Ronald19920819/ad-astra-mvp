import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createClient } from "@supabase/supabase-js";

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

function normalizeEnvironmentLabel(value) {
  return value?.trim().toLowerCase() ?? "";
}

function detectEnvironment() {
  const explicitEnvironmentValues = [
    ["AD_ASTRA_ENV", process.env.AD_ASTRA_ENV],
    ["APP_ENV", process.env.APP_ENV],
    ["VERCEL_ENV", process.env.VERCEL_ENV],
    ["NODE_ENV", process.env.NODE_ENV],
  ];

  for (const [source, value] of explicitEnvironmentValues) {
    const label = normalizeEnvironmentLabel(value);
    if (!label) continue;

    if (["production", "prod", "live"].includes(label)) {
      return { kind: "production", source, value };
    }

    if (["staging", "stage", "preview", "qa", "test"].includes(label)) {
      return { kind: "staging", source, value };
    }

    if (["development", "dev", "local"].includes(label)) {
      return { kind: "development", source, value };
    }
  }

  let hostname = "";
  try {
    hostname = new URL(supabaseUrl).hostname.toLowerCase();
  } catch {
    return {
      kind: "unknown",
      source: "NEXT_PUBLIC_SUPABASE_URL",
      value: supabaseUrl,
    };
  }

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return {
      kind: "development",
      source: "NEXT_PUBLIC_SUPABASE_URL",
      value: hostname,
    };
  }

  if (
    hostname.includes("staging") ||
    hostname.includes("preview") ||
    hostname.includes("qa")
  ) {
    return {
      kind: "staging",
      source: "NEXT_PUBLIC_SUPABASE_URL",
      value: hostname,
    };
  }

  if (hostname.includes("dev") || hostname.includes("local")) {
    return {
      kind: "development",
      source: "NEXT_PUBLIC_SUPABASE_URL",
      value: hostname,
    };
  }

  return {
    kind: "unknown",
    source: "NEXT_PUBLIC_SUPABASE_URL",
    value: hostname,
  };
}

const environment = detectEnvironment();

if (environment.kind === "production") {
  console.error("Development Reset cannot run on Production.");
  process.exit(1);
}

if (environment.kind === "unknown") {
  console.error(
    "Development Reset could not confirm a Development or Staging environment.",
  );
  console.error(
    `Detected source: ${environment.source} = ${environment.value || "unknown"}`,
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const resetTargets = [
  {
    key: "lessons",
    table: "lessons",
  },
  {
    key: "lessonMaterials",
    table: "lesson_materials",
  },
  {
    key: "activities",
    table: "activities",
  },
  {
    key: "activitySubmissions",
    table: "activity_submissions",
  },
  {
    key: "learnerActivityDrafts",
    table: "learner_activity_drafts",
  },
  {
    key: "learnerActivityDraftAnswers",
    table: "learner_activity_draft_answers",
  },
  {
    key: "learnerLessonProgress",
    table: "learner_lesson_progress",
  },
  {
    key: "learnerLessonCompletions",
    table: "learner_lesson_completions",
  },
  {
    key: "learnerQuizAttempts",
    table: "learner_quiz_attempts",
  },
];

const dependentDeleteOrder = [
  { table: "learner_activity_draft_answers" },
  { table: "learner_activity_drafts" },
  { table: "activity_submission_answers" },
  { table: "activity_submissions" },
  { table: "learner_lesson_progress" },
  { table: "learner_lesson_completions" },
  { table: "learner_quiz_attempts" },
  { table: "activity_questions" },
  { table: "activities" },
  { table: "lesson_materials" },
  { table: "lessons" },
];

async function countRows(table) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) throw error;
  return count ?? 0;
}

async function deleteAllRows(table) {
  const { error } = await supabase.from(table).delete().not("id", "is", null);

  if (error) throw error;
}

function formatSummaryLine(label, count) {
  return `${label.padEnd(20, ".")} ${String(count).padStart(2, " ")}`;
}

async function main() {
  const counts = {};
  for (const target of resetTargets) {
    counts[target.key] = await countRows(target.table);
  }

  console.log("---------------------------------------");
  console.log("");
  console.log("AD Astra Development Reset");
  console.log("");
  console.log(formatSummaryLine("Lessons", counts.lessons));
  console.log(formatSummaryLine("Activities", counts.activities));
  console.log(formatSummaryLine("Submissions", counts.activitySubmissions));
  console.log(formatSummaryLine("Activity Drafts", counts.learnerActivityDrafts));
  console.log(formatSummaryLine("Progress", counts.learnerLessonProgress));
  console.log(formatSummaryLine("Quiz Attempts", counts.learnerQuizAttempts));
  console.log("");
  console.log("Proceed? (y/N)");
  console.log("");
  console.log("---------------------------------------");

  const prompt = readline.createInterface({ input, output });
  const answer = (await prompt.question("> ")).trim().toLowerCase();
  await prompt.close();

  if (answer !== "y" && answer !== "yes") {
    console.log("Development Reset cancelled.");
    process.exit(0);
  }

  for (const target of dependentDeleteOrder) {
    await deleteAllRows(target.table);
  }

  console.log("---------------------------------------");
  console.log("");
  console.log("AD Astra Development Reset Complete");
  console.log("");
  console.log(`✓ Lessons deleted: ${counts.lessons}`);
  console.log(`✓ Lesson Materials deleted: ${counts.lessonMaterials}`);
  console.log(`✓ Activities deleted: ${counts.activities}`);
  console.log(`✓ Activity Submissions deleted: ${counts.activitySubmissions}`);
  console.log(`✓ Activity Drafts deleted: ${counts.learnerActivityDrafts}`);
  console.log(
    `✓ Activity Draft Answers deleted: ${counts.learnerActivityDraftAnswers}`,
  );
  console.log(`✓ Lesson Progress deleted: ${counts.learnerLessonProgress}`);
  console.log(`✓ Lesson Completions deleted: ${counts.learnerLessonCompletions}`);
  console.log(`✓ Quiz Attempts deleted: ${counts.learnerQuizAttempts}`);
  console.log("");
  console.log("System ready for a new academic term.");
  console.log("");
  console.log("---------------------------------------");
}

try {
  await main();
} catch (error) {
  console.error("Development Reset failed.");
  console.error(error);
  process.exit(1);
}
