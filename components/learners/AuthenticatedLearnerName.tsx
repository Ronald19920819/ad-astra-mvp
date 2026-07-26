"use client";

import { useAuthenticatedLearnerBasicProfile } from "@/lib/learners/useAuthenticatedLearnerBasicProfile";

export function AuthenticatedLearnerName({
  fallback = "Loading profile...",
}: {
  fallback?: string;
}) {
  const { profile } = useAuthenticatedLearnerBasicProfile();
  return <>{profile?.displayName ?? fallback}</>;
}
