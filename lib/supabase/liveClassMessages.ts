import "server-only";

import { getAuthenticatedLearnerProfile } from "@/lib/supabase/learnerProfile";
import { getSupabaseErrorDetails } from "@/lib/supabase/errorDetails";
import { createSupabaseAdminClient, createSupabaseRequestClient } from "@/lib/supabase/server";
import { verifyLearnerSubjectAccessForProfile } from "@/lib/supabase/subjectAccess";
import { authorizeTeacher } from "@/lib/supabase/teacherAuth";
import { getAuthenticatedTeacherProfile } from "@/lib/supabase/teacherProfile";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MESSAGE_MAX_LENGTH = 500;
const MESSAGE_COOLDOWN_MS = 1500;
const DUPLICATE_MESSAGE_WINDOW_MS = 10_000;

export type LiveClassMessage = {
  id: string;
  subjectId: string;
  senderProfileId: string;
  senderRole: "learner" | "teacher";
  senderDisplayName: string;
  message: string;
  createdAt: string;
};

type LiveClassMessageRow = {
  id: string;
  subject_id: string;
  sender_profile_id: string;
  sender_role: "learner" | "teacher";
  sender_display_name: string;
  message: string;
  created_at: string;
};

type LiveClassMessageDeleteRow = {
  id: string;
  subject_id: string;
  deleted_at: string | null;
};

type LiveClassActor =
  | {
      role: "learner";
      authUserId: string;
      profileId: string;
      displayName: string;
      admin: ReturnType<typeof createSupabaseAdminClient>;
    }
  | {
      role: "teacher";
      authUserId: string;
      profileId: string;
      teacherProfileId: string;
      displayName: string;
      admin: ReturnType<typeof createSupabaseAdminClient>;
    };

export class LiveClassApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "LiveClassApiError";
    this.status = status;
    this.code = code;
  }
}

function invalid(message: string, code = "INVALID_REQUEST") {
  return new LiveClassApiError(400, code, message);
}

export function isUuid(value: string) {
  return uuidPattern.test(value);
}

export function validateSubjectId(subjectId: unknown) {
  if (typeof subjectId !== "string" || !isUuid(subjectId)) {
    throw invalid("A valid subject is required.", "INVALID_SUBJECT");
  }

  return subjectId;
}

export function validateMessageId(messageId: unknown) {
  if (typeof messageId !== "string" || !isUuid(messageId)) {
    throw invalid("A valid message is required.", "INVALID_MESSAGE_ID");
  }

  return messageId;
}

export function parseChatMessage(message: unknown) {
  if (typeof message !== "string") {
    throw invalid("A message is required.", "INVALID_MESSAGE");
  }

  const trimmed = message.trim();
  if (!trimmed) {
    throw invalid("Please enter a message before sending.", "EMPTY_MESSAGE");
  }

  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    throw invalid(
      `Messages must be ${MESSAGE_MAX_LENGTH} characters or fewer.`,
      "MESSAGE_TOO_LONG",
    );
  }

  return trimmed;
}

export async function parseJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw invalid("Malformed JSON request body.", "INVALID_JSON");
  }
}

export function ensureOnlyAllowedKeys(
  body: Record<string, unknown>,
  allowedKeys: string[],
) {
  const extras = Object.keys(body).filter((key) => !allowedKeys.includes(key));
  if (extras.length > 0) {
    throw invalid("This request contains unsupported fields.", "UNSUPPORTED_FIELDS");
  }
}

function mapMessage(row: LiveClassMessageRow): LiveClassMessage {
  return {
    id: row.id,
    subjectId: row.subject_id,
    senderProfileId: row.sender_profile_id,
    senderRole: row.sender_role,
    senderDisplayName: row.sender_display_name,
    message: row.message,
    createdAt: row.created_at,
  };
}

export async function resolveLiveClassActor(
  subjectId: string,
): Promise<LiveClassActor> {
  const requestClient = await createSupabaseRequestClient();
  const {
    data: { user },
    error: userError,
  } = await requestClient.auth.getUser();

  if (userError || !user) {
    throw new LiveClassApiError(
      401,
      "UNAUTHORIZED",
      "Please sign in to access Live Classroom chat.",
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) {
    throw new LiveClassApiError(
      403,
      "FORBIDDEN",
      "You do not have access to this Live Classroom.",
    );
  }

  if (profile.role === "learner") {
    const learner = await getAuthenticatedLearnerProfile();
    if (!learner || learner.userId !== user.id) {
      throw new LiveClassApiError(
        403,
        "FORBIDDEN",
        "You do not have access to this Live Classroom.",
      );
    }

    const access = verifyLearnerSubjectAccessForProfile(learner, subjectId);
    if (!access.allowed) {
      throw new LiveClassApiError(
        403,
        "FORBIDDEN",
        "You do not have access to this Live Classroom.",
      );
    }

    return {
      role: "learner",
      authUserId: user.id,
      profileId: learner.profileId,
      displayName: learner.displayName,
      admin,
    };
  }

  if (profile.role === "teacher") {
    const authorization = await authorizeTeacher(subjectId);
    if (!authorization.success) {
      throw new LiveClassApiError(
        authorization.status,
        authorization.code,
        authorization.status === 401
          ? "Please sign in to access Live Classroom chat."
          : "You do not have access to this Live Classroom.",
      );
    }

    const teacher = await getAuthenticatedTeacherProfile();
    if (!teacher || teacher.userId !== user.id) {
      throw new LiveClassApiError(
        403,
        "FORBIDDEN",
        "You do not have access to this Live Classroom.",
      );
    }

    return {
      role: "teacher",
      authUserId: user.id,
      profileId: teacher.profileId,
      teacherProfileId: authorization.teacher.teacherProfileId,
      displayName: teacher.displayName,
      admin: authorization.teacher.admin,
    };
  }

  throw new LiveClassApiError(
    403,
    "FORBIDDEN",
    "You do not have access to this Live Classroom.",
  );
}

export async function getLiveClassMessages(subjectId: string) {
  const actor = await resolveLiveClassActor(subjectId);
  const { data, error } = await actor.admin
    .from("live_class_messages")
    .select(
      "id, subject_id, sender_profile_id, sender_role, sender_display_name, message, created_at",
    )
    .eq("subject_id", subjectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return (data ?? [])
    .map((row) => mapMessage(row as LiveClassMessageRow))
    .reverse();
}

async function enforceMessageCooldown(
  actor: LiveClassActor,
  subjectId: string,
  message: string,
) {
  const { data, error } = await actor.admin
    .from("live_class_messages")
    .select("created_at, message")
    .eq("subject_id", subjectId)
    .eq("sender_profile_id", actor.profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return;

  const lastSentAt = new Date(data.created_at).getTime();
  const now = Date.now();
  const elapsedMs = now - lastSentAt;

  if (data.message === message && elapsedMs < DUPLICATE_MESSAGE_WINDOW_MS) {
    throw new LiveClassApiError(
      409,
      "DUPLICATE_MESSAGE",
      "That message was just sent.",
    );
  }

  if (elapsedMs < MESSAGE_COOLDOWN_MS) {
    throw new LiveClassApiError(
      429,
      "MESSAGE_RATE_LIMITED",
      "Please wait a moment before sending another message.",
    );
  }
}

export async function createLiveClassMessage(subjectId: string, message: string) {
  const actor = await resolveLiveClassActor(subjectId);
  await enforceMessageCooldown(actor, subjectId, message);

  const { data, error } = await actor.admin
    .from("live_class_messages")
    .insert({
      subject_id: subjectId,
      sender_profile_id: actor.profileId,
      sender_role: actor.role,
      sender_display_name: actor.displayName,
      message,
    })
    .select(
      "id, subject_id, sender_profile_id, sender_role, sender_display_name, message, created_at",
    )
    .single();

  if (error) throw error;
  return mapMessage(data as LiveClassMessageRow);
}

export async function softDeleteLiveClassMessage(messageId: string) {
  const baseAuthorization = await authorizeTeacher();
  if (!baseAuthorization.success) {
    throw new LiveClassApiError(
      baseAuthorization.status,
      baseAuthorization.code,
      baseAuthorization.status === 401
        ? "Please sign in to manage Live Classroom chat."
        : "Teacher access is required to manage Live Classroom chat.",
    );
  }

  const { admin, teacherProfileId } = baseAuthorization.teacher;
  const { data: message, error: messageError } = await admin
    .from("live_class_messages")
    .select("id, subject_id, deleted_at")
    .eq("id", messageId)
    .maybeSingle();

  if (messageError) throw messageError;
  if (!message) {
    throw new LiveClassApiError(404, "MESSAGE_NOT_FOUND", "Message not found.");
  }

  const messageRow = message as LiveClassMessageDeleteRow;
  if (messageRow.deleted_at) {
    throw new LiveClassApiError(404, "MESSAGE_NOT_FOUND", "Message not found.");
  }

  const { data: assignment, error: assignmentError } = await admin
    .from("teacher_subjects")
    .select("id")
    .eq("teacher_profile_id", teacherProfileId)
    .eq("subject_id", messageRow.subject_id)
    .eq("status", "active")
    .maybeSingle();

  if (assignmentError) throw assignmentError;
  if (!assignment) {
    throw new LiveClassApiError(
      403,
      "FORBIDDEN",
      "You do not have access to manage this Live Classroom.",
    );
  }

  const { error: updateError } = await admin
    .from("live_class_messages")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by_profile_id: baseAuthorization.teacher.profileId,
    })
    .eq("id", messageId)
    .is("deleted_at", null);

  if (updateError) throw updateError;

  return {
    deleted: true as const,
    messageId,
  };
}

export function logLiveClassApiError(
  context: {
    route: string;
    method: string;
    subjectId?: string | null;
    messageId?: string | null;
    authenticatedProfileId?: string | null;
  },
  error: unknown,
) {
  console.error("Live Classroom API error", {
    ...context,
    ...getSupabaseErrorDetails(error),
  });
}
