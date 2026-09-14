import "server-only";

import { getDiagnosticRequestId } from "@/lib/observability/requestId";

// Shared shape for every safe-fields-only auth/authorization failure log
// across proxy.ts and the downstream page-level auth resolvers
// (teacherAuth.ts, teacherProfile.ts, learnerProfile.ts). Deliberately
// narrow: name/code/status/message only, never a token, cookie, email,
// learner name, or user ID -- see toSafeErrorDetails below.
export type SafeAuthErrorDetails = {
  name?: string;
  code: string | null;
  status: number | null;
  message?: string;
};

export function toSafeErrorDetails(
  error: unknown,
): SafeAuthErrorDetails | undefined {
  if (!error || typeof error !== "object") return undefined;

  const candidate = error as {
    name?: unknown;
    code?: unknown;
    status?: unknown;
    message?: unknown;
  };

  return {
    name: typeof candidate.name === "string" ? candidate.name : undefined,
    code: typeof candidate.code === "string" ? candidate.code : null,
    status: typeof candidate.status === "number" ? candidate.status : null,
    message:
      typeof candidate.message === "string" ? candidate.message : undefined,
  };
}

// stage identifies exactly which step of the auth/profile/authorization
// chain failed (e.g. "teacher-page.auth", "teacher-page.subject-assignment",
// "learner-page.learner-profile") so production logs can distinguish a
// session-resolution failure from a profile-row problem from a
// subject-assignment/enrolment problem, without ever logging IDs, tokens,
// cookies, emails, or names. requestId correlates this line with the
// proxy-stage line (if any) for the same request -- it is diagnostics
// only and is never read for any authorization decision.
//
// Also reused (same safe shape, same requestId correlation) by teacher
// write-path routes that need to distinguish which internal step of a
// multi-step handler failed -- e.g. "lesson-write.lesson_material_write",
// "lesson-pdf.pdf_validation" -- without inventing a second logging
// convention for non-auth failure stages.
export async function logAuthDiagnostic(
  label: string,
  stage: string,
  reason: string,
  error?: unknown,
): Promise<void> {
  const requestId = await getDiagnosticRequestId();
  console.error(label, {
    requestId,
    stage,
    reason,
    error: toSafeErrorDetails(error),
  });
}
