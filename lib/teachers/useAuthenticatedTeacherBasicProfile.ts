"use client";

import { useEffect, useState } from "react";
import type { AuthenticatedTeacherProfile } from "./teacherProfile";

type TeacherBasicProfile = Pick<
  AuthenticatedTeacherProfile,
  "displayName" | "email" | "school" | "profileImageUrl"
>;

let cachedProfile: TeacherBasicProfile | null = null;
let profileRequest: Promise<TeacherBasicProfile | null> | null = null;

async function loadTeacherBasicProfile() {
  if (cachedProfile) return cachedProfile;
  if (!profileRequest) {
    profileRequest = (async () => {
      try {
        const response = await fetch("/api/teacher/basic-profile", {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          profile?: TeacherBasicProfile;
        };
        cachedProfile = response.ok ? (data.profile ?? null) : null;
        return cachedProfile;
      } catch (error) {
        console.error("Unable to load teacher profile:", error);
        return null;
      } finally {
        profileRequest = null;
      }
    })();
  }

  return profileRequest;
}

export function useAuthenticatedTeacherBasicProfile() {
  const [profile, setProfile] = useState<TeacherBasicProfile | null>(
    cachedProfile,
  );
  const [isLoading, setIsLoading] = useState(cachedProfile === null);

  useEffect(() => {
    let isActive = true;

    async function loadProfile() {
      const nextProfile = await loadTeacherBasicProfile();
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
