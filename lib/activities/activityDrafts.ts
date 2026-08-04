export type LearnerActivityDraftAnswer = {
  questionId: string;
  answerText: string;
};

export type LearnerActivityDraft = {
  id: string;
  activityId: string;
  learnerId: string;
  subjectId: string;
  activityVersion: number;
  revision: number;
  updatedAt: string;
  answers: LearnerActivityDraftAnswer[];
};

export type LocalLearnerActivityDraftCache = {
  learnerId: string;
  subjectId: string;
  activityId: string;
  activityVersion: number;
  revision: number;
  updatedAt: string;
  answers: Record<string, string>;
  dirty: boolean;
};

export function buildActivityDraftCacheKey(input: {
  learnerId: string;
  subjectId: string;
  activityId: string;
}) {
  return `ad-astra:activity-draft:${input.learnerId}:${input.subjectId}:${input.activityId}`;
}

export function answersRecordFromDraft(
  answers: LearnerActivityDraftAnswer[],
): Record<string, string> {
  return Object.fromEntries(
    answers
      .filter((answer) => typeof answer.answerText === "string")
      .map((answer) => [answer.questionId, answer.answerText]),
  );
}

export function reconcileAnswersForQuestionIds(
  questionIds: string[],
  answers: Record<string, string>,
) {
  const questionIdSet = new Set(questionIds);
  return Object.fromEntries(
    Object.entries(answers).filter(
      ([questionId, answerText]) =>
        questionIdSet.has(questionId) && typeof answerText === "string",
    ),
  );
}

export function parseLocalLearnerActivityDraftCache(
  value: string | null,
): LocalLearnerActivityDraftCache | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (
      typeof parsed.learnerId !== "string" ||
      typeof parsed.subjectId !== "string" ||
      typeof parsed.activityId !== "string" ||
      !Number.isInteger(parsed.activityVersion) ||
      !Number.isInteger(parsed.revision) ||
      typeof parsed.updatedAt !== "string" ||
      typeof parsed.dirty !== "boolean" ||
      !parsed.answers ||
      typeof parsed.answers !== "object" ||
      Array.isArray(parsed.answers)
    ) {
      return null;
    }

    const answers = Object.fromEntries(
      Object.entries(parsed.answers).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );

    return {
      learnerId: parsed.learnerId,
      subjectId: parsed.subjectId,
      activityId: parsed.activityId,
      activityVersion: parsed.activityVersion as number,
      revision: parsed.revision as number,
      updatedAt: parsed.updatedAt,
      answers,
      dirty: parsed.dirty,
    };
  } catch {
    return null;
  }
}

export function choosePreferredDraftSource(input: {
  serverDraft: LearnerActivityDraft | null;
  localDraft: LocalLearnerActivityDraftCache | null;
}) {
  const { serverDraft, localDraft } = input;

  if (serverDraft && localDraft) {
    if (localDraft.revision > serverDraft.revision) {
      return { winner: "local" as const, newerDraftFound: false };
    }

    if (serverDraft.revision > localDraft.revision) {
      return { winner: "server" as const, newerDraftFound: true };
    }

    const localTime = Date.parse(localDraft.updatedAt);
    const serverTime = Date.parse(serverDraft.updatedAt);

    if (Number.isFinite(localTime) && Number.isFinite(serverTime)) {
      if (localTime > serverTime) {
        return { winner: "local" as const, newerDraftFound: false };
      }

      if (serverTime > localTime) {
        return { winner: "server" as const, newerDraftFound: true };
      }
    }

    if (localDraft.dirty) {
      return { winner: "local" as const, newerDraftFound: false };
    }

    return { winner: "server" as const, newerDraftFound: false };
  }

  if (localDraft) {
    return { winner: "local" as const, newerDraftFound: false };
  }

  if (serverDraft) {
    return { winner: "server" as const, newerDraftFound: false };
  }

  return { winner: "none" as const, newerDraftFound: false };
}
