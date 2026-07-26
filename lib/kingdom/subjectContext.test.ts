import assert from "node:assert/strict";
import test from "node:test";
import { buildKingdomPromptPipeline } from "./promptPipeline";
import { buildKingdomSubjectContext } from "./subjectContext";
import {
  getSubjectConfigurationByDatabaseId,
  subjectConfigurations,
} from "../subjects/subjectConfig";
import {
  getSubjectCardStatus,
  getSubjectNextAction,
} from "../subjects/learnerStatus";
import { resolveCurrentTopicTitle } from "../subjects/currentTopic";

test("subject registry preserves established colours for the active rollout", () => {
  assert.equal(
    subjectConfigurations["business-studies"].colourTheme.primary,
    "#F97316",
  );
  assert.equal(subjectConfigurations.english.colourTheme.primary, "#2563EB");
  assert.equal(subjectConfigurations.afrikaans.colourTheme.primary, "#EB2525");
  assert.equal(subjectConfigurations.history.colourTheme.primary, "#3AAA35");
  assert.equal(subjectConfigurations["business-studies"].rolloutStatus, "reference");
  assert.equal(subjectConfigurations.english.rolloutStatus, "active");
  assert.equal(subjectConfigurations.afrikaans.rolloutStatus, "active");
  assert.equal(subjectConfigurations.history.rolloutStatus, "active");
});

test("each rolled-out subject supplies its own Kingdom conventions", () => {
  const english = buildKingdomSubjectContext({
    subjectKey: "english",
    role: "Tutor",
    taskType: "Support a reading response",
  });
  const afrikaans = buildKingdomSubjectContext({
    subjectKey: "afrikaans",
    role: "Author",
    taskType: "Generate a reading",
  });
  const history = buildKingdomSubjectContext({
    subjectKey: "history",
    role: "Analyst",
    taskType: "Analyse learner progress",
  });

  assert.equal(english.framework, "Cambridge Lower Secondary");
  assert.match(english.questionConventions.join(" "), /Reading and Writing/);
  assert.doesNotMatch(english.questionConventions.join(" "), /\bAO[1-4]\b/);

  assert.equal(afrikaans.framework, "CAPS");
  assert.equal(afrikaans.teacherPreferences.outputLanguage, "Afrikaans");
  assert.match(afrikaans.questionConventions.join(" "), /Lees en Kyk/);
  assert.doesNotMatch(afrikaans.questionConventions.join(" "), /Cambridge|Business Studies|\bAO[1-4]\b/);

  assert.equal(history.framework, "Cambridge IGCSE 0470");
  assert.match(history.questionConventions.join(" "), /source-based/);
  assert.match(history.questionConventions.join(" "), /4-, 6- and 10-mark/);
  assert.doesNotMatch(history.questionConventions.join(" "), /CAPS|Lees en Kyk/);
});

test("subject identifiers and route families resolve independently", () => {
  const routeSets = Object.values(subjectConfigurations).map((subject) => {
    assert.equal(
      getSubjectConfigurationByDatabaseId(subject.databaseId)?.key,
      subject.key,
    );
    assert.match(subject.routes.learnerDashboard, new RegExp(subject.slug));
    assert.match(subject.routes.teacherOverview, new RegExp(subject.slug));
    return Object.values(subject.routes).join("|");
  });

  assert.equal(new Set(routeSets).size, routeSets.length);
});

test("Business Studies context includes role, framework and preferences", () => {
  const context = buildKingdomSubjectContext({
    subjectKey: "business-studies",
    role: "Author",
    taskType: "Generate lesson reading",
    stageOrGrade: "Grade 10",
    teacherPreferences: {
      preferredDepth: "concise",
    },
  });

  assert.equal(context.subject, "Business Studies");
  assert.equal(context.framework, "Cambridge IGCSE");
  assert.equal(context.stageOrGrade, "Grade 10");
  assert.equal(context.role, "Author");
  assert.equal(context.taskType, "Generate lesson reading");
  assert.equal(context.teacherPreferences.useCambridgeCommandWords, true);
  assert.equal(context.teacherPreferences.preferredDepth, "concise");
});

test("Kingdom prompt pipeline preserves the required section order", () => {
  const context = buildKingdomSubjectContext({
    subjectKey: "business-studies",
    role: "Examiner",
    taskType: "Mark learner activity",
  });
  const prompt = buildKingdomPromptPipeline({
    subjectContext: context,
    roleInstruction: "Kingdom Examiner",
    lessonContext: { lessonTitle: "Operations" },
    currentTask: { activityTitle: "Inputs" },
    prompt: "Apply the marking rules.",
  });
  const headings = [
    "KINGDOM ROLE",
    "SUBJECT CONTEXT",
    "LESSON CONTEXT",
    "TEACHER PREFERENCES",
    "CURRENT TASK",
    "PROMPT",
  ];

  for (let index = 1; index < headings.length; index += 1) {
    assert.ok(
      prompt.indexOf(headings[index - 1]) < prompt.indexOf(headings[index]),
    );
  }
  assert.match(prompt, /Business Studies/);
  assert.match(prompt, /Cambridge IGCSE/);
});

test("shared learner status and current-topic helpers preserve behaviour", () => {
  assert.equal(
    getSubjectNextAction({
      hasIncompleteLesson: true,
      hasIncompleteActivity: true,
    }),
    "Lesson & Activity",
  );
  assert.equal(getSubjectCardStatus("None"), "Up to Date");
  assert.equal(getSubjectCardStatus("Lesson"), "Attention Required");
  assert.equal(
    resolveCurrentTopicTitle({
      topicTitle: " Operations ",
      lessonTitle: "Business Inputs",
    }),
    "Operations",
  );
  assert.equal(
    resolveCurrentTopicTitle({
      topicTitle: null,
      lessonTitle: " Business Inputs ",
    }),
    "Business Inputs",
  );

  for (const subject of Object.values(subjectConfigurations)) {
    assert.equal(
      resolveCurrentTopicTitle({
        topicTitle: `${subject.displayName} Topic`,
        lessonTitle: `${subject.displayName} Lesson`,
      }),
      `${subject.displayName} Topic`,
    );
    assert.equal(
      getSubjectCardStatus(
        getSubjectNextAction({
          hasIncompleteLesson: false,
          hasIncompleteActivity: false,
        }),
      ),
      "Up to Date",
    );
  }
});
