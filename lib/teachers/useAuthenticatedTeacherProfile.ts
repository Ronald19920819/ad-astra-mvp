"use client";

import { useEffect, useState } from "react";
import type { TeacherProfileDashboard } from "./teacherProfile";

export function useAuthenticatedTeacherProfile() {
  const [dashboard, setDashboard] =
    useState<TeacherProfileDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function loadProfile() {
      try {
        const response = await fetch("/api/teacher/profile", {
          cache: "no-store",
        });
        const data = (await response.json()) as TeacherProfileDashboard;
        if (isActive && response.ok) setDashboard(data);
      } catch (error) {
        console.error("Unable to load teacher profile:", error);
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadProfile();
    return () => {
      isActive = false;
    };
  }, []);

  return { dashboard, isLoading };
}
