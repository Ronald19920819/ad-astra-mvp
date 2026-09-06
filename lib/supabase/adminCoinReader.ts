import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSubjectConfigurationByDatabaseId } from "@/lib/subjects/subjectConfig";

// AD ASTRA ADMINISTRATOR HUB -- COIN VIEWER, STAGE 1.
//
// The canonical Coin ledger is public.coin_transactions -- immutable,
// append-only, and the ONLY source of truth. There is deliberately no
// cached balance column anywhere: every balance/total here is computed
// by summing real ledger rows, never read from a stored field. Nothing
// in this file writes to coin_transactions -- Stage 1 is read-only by
// design (see the migration's own header comment and this stage's own
// scope).
//
// Query shape: a small, fixed number of batched queries regardless of
// learner count -- never one query per learner (no N+1). The overview
// pulls the ENTIRE coin_transactions table once and aggregates in
// application code; at the current and near-future data volume this is
// simpler and just as correct as a database-side GROUP BY, and avoids a
// new SQL function/migration for a Stage 1 read-only viewer. If the
// ledger grows very large, replacing this aggregation with a Postgres-
// side GROUP BY (via an RPC) would be the natural next optimisation --
// deliberately not built now since it isn't needed yet.

export type AdminCoinLearnerSummary = {
  learnerId: string;
  learnerName: string;
  currentBalance: number;
  totalEarned: number;
  totalSpent: number;
  lastActivityAt: string | null;
};

export type AdminCoinOverview = {
  totalCoinsInCirculation: number;
  learnersWithCoins: number;
  totalCoinsEarned: number;
  totalCoinsSpent: number;
  learners: AdminCoinLearnerSummary[];
};

type LedgerAggregate = {
  balance: number;
  earned: number;
  spent: number;
  lastActivityAt: string | null;
};

function emptyAggregate(): LedgerAggregate {
  return { balance: 0, earned: 0, spent: 0, lastActivityAt: null };
}

function foldTransaction(aggregate: LedgerAggregate, amount: number, createdAt: string): LedgerAggregate {
  return {
    balance: aggregate.balance + amount,
    earned: aggregate.earned + (amount > 0 ? amount : 0),
    spent: aggregate.spent + (amount < 0 ? -amount : 0),
    lastActivityAt:
      aggregate.lastActivityAt === null || createdAt > aggregate.lastActivityAt
        ? createdAt
        : aggregate.lastActivityAt,
  };
}

// AD ASTRA ADMINISTRATOR HUB -- COIN VIEWER, STAGE 1, PART H: every
// currently active learner appears (even with a genuine 0 AC balance, so
// an administrator can find them ahead of a future manual-adjustment
// stage), UNIONED with every learner who has ever appeared in the ledger
// even if their enrolment/account is no longer active -- ledger history
// is never hidden just because a learner's current status changed. This
// stays a small, fixed number of batched queries: one full ledger read,
// one active-learner-profiles read, and one or two profiles reads (never
// one query per learner).
export async function getAdminCoinOverview(): Promise<AdminCoinOverview> {
  const supabase = createSupabaseAdminClient();

  const { data: transactionRows, error: transactionsError } = await supabase
    .from("coin_transactions")
    .select("learner_id, amount, created_at");
  if (transactionsError) throw transactionsError;

  const aggregateByLearnerId = new Map<string, LedgerAggregate>();
  let totalCoinsInCirculation = 0;
  let totalCoinsEarned = 0;
  let totalCoinsSpent = 0;
  for (const row of transactionRows ?? []) {
    const current = aggregateByLearnerId.get(row.learner_id) ?? emptyAggregate();
    aggregateByLearnerId.set(row.learner_id, foldTransaction(current, row.amount, row.created_at));
    totalCoinsInCirculation += row.amount;
    if (row.amount > 0) totalCoinsEarned += row.amount;
    else if (row.amount < 0) totalCoinsSpent += -row.amount;
  }

  const { data: activeLearnerProfiles, error: learnerProfilesError } = await supabase
    .from("learner_profiles")
    .select("profile_id")
    .eq("status", "active");
  if (learnerProfilesError) throw learnerProfilesError;

  const activeProfileIds = (activeLearnerProfiles ?? []).map((row) => row.profile_id);

  const { data: activeProfiles, error: activeProfilesError } =
    activeProfileIds.length > 0
      ? await supabase
          .from("profiles")
          .select("auth_user_id, full_name")
          .eq("role", "learner")
          .in("id", activeProfileIds)
      : { data: [], error: null };
  if (activeProfilesError) throw activeProfilesError;

  const nameByAuthUserId = new Map<string, string>();
  const learnerIds = new Set<string>();
  for (const profile of activeProfiles ?? []) {
    if (typeof profile.auth_user_id !== "string") continue;
    learnerIds.add(profile.auth_user_id);
    nameByAuthUserId.set(
      profile.auth_user_id,
      typeof profile.full_name === "string" && profile.full_name.trim()
        ? profile.full_name.trim()
        : "Learner",
    );
  }

  // Any learner who appears in the ledger but wasn't in the active-learner
  // batch above (e.g. no longer active) still needs a name resolved --
  // one more batched lookup, never per-row.
  const ledgerOnlyIds = [...aggregateByLearnerId.keys()].filter((id) => !learnerIds.has(id));
  if (ledgerOnlyIds.length > 0) {
    const { data: ledgerOnlyProfiles, error: ledgerOnlyProfilesError } = await supabase
      .from("profiles")
      .select("auth_user_id, full_name")
      .eq("role", "learner")
      .in("auth_user_id", ledgerOnlyIds);
    if (ledgerOnlyProfilesError) throw ledgerOnlyProfilesError;
    for (const profile of ledgerOnlyProfiles ?? []) {
      if (typeof profile.auth_user_id !== "string") continue;
      learnerIds.add(profile.auth_user_id);
      nameByAuthUserId.set(
        profile.auth_user_id,
        typeof profile.full_name === "string" && profile.full_name.trim()
          ? profile.full_name.trim()
          : "Learner",
      );
    }
  }

  const learners: AdminCoinLearnerSummary[] = [...learnerIds].map((learnerId) => {
    const aggregate = aggregateByLearnerId.get(learnerId) ?? emptyAggregate();
    return {
      learnerId,
      learnerName: nameByAuthUserId.get(learnerId) ?? "Learner",
      currentBalance: aggregate.balance,
      totalEarned: aggregate.earned,
      totalSpent: aggregate.spent,
      lastActivityAt: aggregate.lastActivityAt,
    };
  });

  // Deterministic default sort -- current balance highest to lowest,
  // then learner name alphabetically for a stable tie-break -- never
  // left to however the batched queries happened to return rows.
  learners.sort((a, b) => {
    if (a.currentBalance !== b.currentBalance) return b.currentBalance - a.currentBalance;
    return a.learnerName.localeCompare(b.learnerName);
  });

  return {
    totalCoinsInCirculation,
    learnersWithCoins: learners.filter((learner) => learner.currentBalance > 0).length,
    totalCoinsEarned,
    totalCoinsSpent,
    learners,
  };
}

export type AdminCoinTransactionEntry = {
  id: string;
  amount: number;
  transactionType: string;
  createdAt: string;
  reason: string | null;
  subjectName: string | null;
  lessonLabel: string | null;
  activityTitle: string | null;
  actorType: string;
  actorName: string | null;
};

export type AdminLearnerCoinHistory = {
  learnerId: string;
  learnerName: string;
  currentBalance: number;
  totalEarned: number;
  totalSpent: number;
  transactions: AdminCoinTransactionEntry[];
};

// AD ASTRA ADMINISTRATOR HUB -- COIN VIEWER, STAGE 1, PART I/L: only ever
// fetched when the administrator opens ONE specific learner -- never as
// part of the overview. Resolves subject/lesson/activity/actor names via
// a small, fixed number of BATCHED lookups (never one query per
// transaction): subject names come from the static subject configuration
// (no query at all), lesson/activity/actor names each come from exactly
// one .in(...) query across every distinct id this learner's own
// transactions reference.
export async function getAdminLearnerCoinHistory(
  learnerId: string,
): Promise<AdminLearnerCoinHistory | null> {
  const supabase = createSupabaseAdminClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("auth_user_id", learnerId)
    .eq("role", "learner")
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return null;

  const { data: rows, error: transactionsError } = await supabase
    .from("coin_transactions")
    .select(
      "id, amount, transaction_type, subject_id, lesson_id, activity_id, actor_type, actor_id, reason, created_at",
    )
    .eq("learner_id", learnerId)
    .order("created_at", { ascending: false });
  if (transactionsError) throw transactionsError;

  const transactionRows = rows ?? [];

  const lessonIds = [...new Set(transactionRows.map((row) => row.lesson_id).filter((id): id is string => Boolean(id)))];
  const activityIds = [...new Set(transactionRows.map((row) => row.activity_id).filter((id): id is string => Boolean(id)))];
  const actorIds = [...new Set(transactionRows.map((row) => row.actor_id).filter((id): id is string => Boolean(id)))];

  const [lessonRowsResult, activityRowsResult, actorProfilesResult] = await Promise.all([
    lessonIds.length > 0
      ? supabase.from("lessons").select("id, lesson_number, title").in("id", lessonIds)
      : Promise.resolve({ data: [], error: null }),
    activityIds.length > 0
      ? supabase.from("activities").select("id, title").in("id", activityIds)
      : Promise.resolve({ data: [], error: null }),
    actorIds.length > 0
      ? supabase.from("profiles").select("auth_user_id, full_name").in("auth_user_id", actorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (lessonRowsResult.error) throw lessonRowsResult.error;
  if (activityRowsResult.error) throw activityRowsResult.error;
  if (actorProfilesResult.error) throw actorProfilesResult.error;

  const lessonById = new Map(
    (lessonRowsResult.data ?? []).map((lesson) => [lesson.id, `Lesson ${lesson.lesson_number} — ${lesson.title}`]),
  );
  const activityTitleById = new Map((activityRowsResult.data ?? []).map((activity) => [activity.id, activity.title]));
  const actorNameByAuthUserId = new Map(
    (actorProfilesResult.data ?? [])
      .filter((actorProfile): actorProfile is { auth_user_id: string; full_name: string | null } =>
        typeof actorProfile.auth_user_id === "string",
      )
      .map((actorProfile) => [actorProfile.auth_user_id, actorProfile.full_name?.trim() || "Unknown"]),
  );

  const transactions: AdminCoinTransactionEntry[] = transactionRows.map((row) => ({
    id: row.id,
    amount: row.amount,
    transactionType: row.transaction_type,
    createdAt: row.created_at,
    reason: row.reason,
    subjectName: row.subject_id ? getSubjectConfigurationByDatabaseId(row.subject_id)?.displayName ?? "Subject" : null,
    lessonLabel: row.lesson_id ? lessonById.get(row.lesson_id) ?? null : null,
    activityTitle: row.activity_id ? activityTitleById.get(row.activity_id) ?? null : null,
    actorType: row.actor_type,
    actorName: row.actor_id ? actorNameByAuthUserId.get(row.actor_id) ?? null : null,
  }));

  const aggregate = transactionRows.reduce(
    (acc, row) => foldTransaction(acc, row.amount, row.created_at),
    emptyAggregate(),
  );

  return {
    learnerId,
    learnerName:
      typeof profile.full_name === "string" && profile.full_name.trim() ? profile.full_name.trim() : "Learner",
    currentBalance: aggregate.balance,
    totalEarned: aggregate.earned,
    totalSpent: aggregate.spent,
    transactions,
  };
}
