"use client";

import type { ProfileIdentity } from "@/lib/profiles/profileIdentity";
import { getProfileInitials } from "@/lib/profiles/profileIdentity";

export function ProfileAvatar({
  profile,
  role,
  className = "",
}: {
  profile: ProfileIdentity | null;
  role: "Learner" | "Teacher";
  className?: string;
}) {
  const displayName = profile?.displayName ?? role;

  if (profile?.profileImageUrl) {
    return (
      // Authenticated profile images may use provider domains unknown at build time.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.profileImageUrl}
        alt={`${displayName} profile`}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`${displayName} profile`}
      className={`flex h-full w-full items-center justify-center bg-[#EEF7FF] text-4xl font-bold text-[#102A43] ${className}`}
    >
      {getProfileInitials(profile, role.charAt(0))}
    </div>
  );
}
