"use client";

import { useAuthenticatedTeacherBasicProfile } from "@/lib/teachers/useAuthenticatedTeacherBasicProfile";

export function AuthenticatedTeacherName() {
  const { profile } = useAuthenticatedTeacherBasicProfile();
  return <>{profile?.displayName ?? "Teacher"}</>;
}
