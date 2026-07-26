"use client";

import type { AuthenticatedLearnerProfile } from "@/lib/learners/learnerProfile";
import { ProfileAvatar } from "@/components/profiles/ProfileAvatar";

export function LearnerAvatar({
  profile,
  className = "",
}: {
  profile: AuthenticatedLearnerProfile | null;
  className?: string;
}) {
  return (
    <ProfileAvatar profile={profile} role="Learner" className={className} />
  );
}
