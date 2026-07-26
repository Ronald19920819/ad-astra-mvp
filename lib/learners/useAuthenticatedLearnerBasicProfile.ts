"use client";

import { useEffect, useState } from "react";
import type { AuthenticatedLearnerProfile } from "./learnerProfile";

type LearnerBasicProfile = Pick<
  AuthenticatedLearnerProfile,
  | "firstName"
  | "surname"
  | "fullName"
  | "displayName"
  | "initials"
  | "email"
  | "school"
  | "gradeStage"
  | "gradeOrStage"
  | "profileImageUrl"
>;

let cachedProfile: LearnerBasicProfile | null = null;
let profileRequest: Promise<LearnerBasicProfile | null> | null = null;

async function loadLearnerBasicProfile() {
  if (cachedProfile) return cachedProfile;
  if (!profileRequest) {
    profileRequest = (async () => {
      try {
        const response = await fetch("/api/learner/profile", {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json()) as {
          profile?: LearnerBasicProfile;
        };
        cachedProfile = response.ok ? (data.profile ?? null) : null;
        return cachedProfile;
      } catch (error) {
        console.error("Unable to load learner profile:", error);
        return null;
      } finally {
        profileRequest = null;
      }
    })();
  }

  return profileRequest;
}

export function useAuthenticatedLearnerBasicProfile() {
  const [profile, setProfile] = useState<LearnerBasicProfile | null>(
    cachedProfile,
  );
  const [isLoading, setIsLoading] = useState(cachedProfile === null);

  useEffect(() => {
    let isActive = true;

    async function loadProfile() {
      const nextProfile = await loadLearnerBasicProfile();
      if (isActive) {
        setProfile(nextProfile);
        setIsLoading(false);
      }
    }

    void loadProfile();
    return () => {
      isActive = false;
    };
  }, []);

  return { profile, isLoading };
}
