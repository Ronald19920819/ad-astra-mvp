import "server-only";

import {
  approvalTransition,
  canReviewLearnerRequest,
  type LearnerApprovalRequest,
} from "@/lib/approvals/learnerApprovals";
import { authorizeTeacher } from "@/lib/supabase/teacherAuth";

function authorizationError(message: string, status: number, code: string) {
  const error = new Error(message);
  error.name = code;
  return Object.assign(error, { status });
}

export async function getPendingLearnerApprovals():
  Promise<LearnerApprovalRequest[]> {
  const authorization = await authorizeTeacher();
  if (!authorization.success) {
    throw authorizationError(
      authorization.error,
      authorization.status,
      authorization.code,
    );
  }

  const { admin, teacherProfileId } = authorization.teacher;
  const { data: assignments, error: assignmentError } = await admin
    .from("teacher_subjects")
    .select("subject_id")
    .eq("teacher_profile_id", teacherProfileId)
    .eq("status", "active");
  if (assignmentError) throw assignmentError;

  const subjectIds = (assignments ?? []).map(
    (assignment) => assignment.subject_id,
  );
  if (subjectIds.length === 0) return [];

  const { data: requests, error: requestError } = await admin
    .from("learner_subjects")
    .select(`
      id,
      subject_id,
      requested_at,
      learner:learner_profiles(
        grade,
        school_name,
        profile:profiles(auth_user_id, full_name, first_name, surname)
      ),
      subject:subjects(name)
    `)
    .in("subject_id", subjectIds)
    .eq("status", "pending")
    .order("requested_at", { ascending: true });
  if (requestError) throw requestError;

  return Promise.all(
    (requests ?? []).flatMap((request) => {
      const learner = Array.isArray(request.learner)
        ? request.learner[0]
        : request.learner;
      const profileValue = learner?.profile;
      const profile = Array.isArray(profileValue)
        ? profileValue[0]
        : profileValue;
      const subject = Array.isArray(request.subject)
        ? request.subject[0]
        : request.subject;
      if (!learner || !profile || !subject) return [];

      return [
        (async (): Promise<LearnerApprovalRequest> => {
          const { data: authData } = await admin.auth.admin.getUserById(
            profile.auth_user_id,
          );
          const databaseName =
            typeof profile.full_name === "string"
              ? profile.full_name.trim()
              : "";
          const separateName = [profile.first_name, profile.surname]
            .filter(
              (part): part is string =>
                typeof part === "string" && Boolean(part.trim()),
            )
            .map((part) => part.trim())
            .join(" ");

          return {
            id: request.id,
            learnerName: databaseName || separateName || "Learner",
            learnerEmail: authData.user?.email ?? null,
            school: learner.school_name?.trim() || null,
            gradeOrStage: learner.grade?.trim() || null,
            subjectId: request.subject_id,
            subjectName: subject.name,
            requestedAt: request.requested_at,
            status: "pending",
          };
        })(),
      ];
    }),
  );
}

export async function reviewLearnerApproval(
  requestId: string,
  action: "approve" | "decline",
) {
  const authorization = await authorizeTeacher();
  if (!authorization.success) {
    throw authorizationError(
      authorization.error,
      authorization.status,
      authorization.code,
    );
  }

  const { admin, teacherProfileId } = authorization.teacher;
  const { data: request, error: requestError } = await admin
    .from("learner_subjects")
    .select("id, subject_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (requestError) throw requestError;
  if (!request) {
    throw authorizationError("Learner approval request not found.", 404, "NOT_FOUND");
  }
  if (request.status !== "pending") {
    throw authorizationError(
      "This learner approval request has already been reviewed.",
      409,
      "ALREADY_REVIEWED",
    );
  }

  const { data: assignments, error: assignmentError } = await admin
    .from("teacher_subjects")
    .select("subject_id")
    .eq("teacher_profile_id", teacherProfileId)
    .eq("status", "active");
  if (assignmentError) throw assignmentError;

  if (!canReviewLearnerRequest({
    authenticatedRole: "teacher",
    teacherIsActive: true,
    assignedSubjectIds: (assignments ?? []).map(
      (assignment) => assignment.subject_id,
    ),
    requestedSubjectId: request.subject_id,
  })) {
    throw authorizationError(
      "Teacher access to this subject request is required.",
      403,
      "FORBIDDEN",
    );
  }

  const now = new Date().toISOString();
  const transition = approvalTransition(action);
  const changes =
    action === "approve"
      ? {
          ...transition,
          approved_at: now,
          approved_by: teacherProfileId,
          reviewed_at: now,
          reviewed_by: teacherProfileId,
        }
      : {
          ...transition,
          reviewed_at: now,
          reviewed_by: teacherProfileId,
        };
  const { data: updated, error: updateError } = await admin
    .from("learner_subjects")
    .update(changes)
    .eq("id", request.id)
    .eq("status", "pending")
    .select("id, subject_id, status, is_active")
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updated) {
    throw authorizationError(
      "This learner approval request was reviewed by someone else.",
      409,
      "ALREADY_REVIEWED",
    );
  }

  return updated;
}
