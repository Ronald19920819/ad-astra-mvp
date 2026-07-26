"use client";

import { useEffect, useState } from "react";
import type { AuthenticatedLearnerProfile } from "./learnerProfile";
import type { LearnerJourney } from "@/lib/progress/learnerJourney";

export function useAuthenticatedLearnerProfile() {
  const [profile, setProfile] =
    useState<AuthenticatedLearnerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [journey, setJourney] = useState<LearnerJourney | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadProfile() {
      try {
        const response = await fetch("/api/learner/profile-page", {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json()) as {
          profile?: AuthenticatedLearnerProfile;
          journey?: LearnerJourney;
        };

        if (isActive && response.ok && data.profile) {
          setProfile(data.profile);
          setJourney(data.journey ?? null);
        }
      } catch (error) {
        console.error("Unable to load learner profile:", error);
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadProfile();
    return () => {
      isActive = false;
    };
  }, []);

  return { profile, journey, isLoading };
}
