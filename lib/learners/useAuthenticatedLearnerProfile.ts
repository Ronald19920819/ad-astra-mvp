"use client";

import { useEffect, useState } from "react";
import type { AuthenticatedLearnerProfile } from "./learnerProfile";
import type { LearnerJourney } from "@/lib/progress/learnerJourney";
import type { LearnerXpSummary } from "@/lib/supabase/learnerXpReader";

// Only the fields app/api/learner/profile-page/route.ts actually sends for
// rewards (xp summary + AC balance) -- never the full transaction list,
// since Profile is a status snapshot only. Either field can independently
// be null on a genuine load failure (never a fake 0) -- see
// lib/supabase/learnerRewardsSummary.ts.
export type ProfilePageRewardsSummary = {
  xp: LearnerXpSummary | null;
  acBalance: number | null;
};

export function useAuthenticatedLearnerProfile() {
  const [profile, setProfile] =
    useState<AuthenticatedLearnerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [journey, setJourney] = useState<LearnerJourney | null>(null);
  const [rewards, setRewards] = useState<ProfilePageRewardsSummary | null>(null);

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
          rewards?: ProfilePageRewardsSummary;
        };

        if (isActive && response.ok && data.profile) {
          setProfile(data.profile);
          setJourney(data.journey ?? null);
          setRewards(data.rewards ?? null);
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

  return { profile, journey, rewards, isLoading };
}
