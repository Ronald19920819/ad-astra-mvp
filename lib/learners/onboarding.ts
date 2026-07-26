import type { LearnerOnboardingSubjectStatus } from "@/lib/supabase/learnerOnboarding";

export function learnerOnboardingDestination(input: {
  hasLearnerProfile: boolean;
  profileComplete: boolean;
  hasAnySubjectRequest: boolean;
}) {
  if (!input.hasLearnerProfile || !input.profileComplete) {
    return "/onboarding/profile";
  }
  if (!input.hasAnySubjectRequest) return "/onboarding/subjects";
  return "/home";
}

export function canRequestLearnerSubject(
  status: LearnerOnboardingSubjectStatus,
) {
  return status === null || status === "declined" || status === "inactive";
}

export function learnerRegistrationError(input: {
  firstName: string;
  surname: string;
  email: string;
  password: string;
  confirmPassword: string;
}) {
  if (!input.firstName.trim() || !input.surname.trim() || !input.email.trim()) {
    return "Complete your name and email address.";
  }
  if (
    input.password.length < 8 ||
    !/[A-Za-z]/.test(input.password) ||
    !/[0-9]/.test(input.password)
  ) {
    return "Use at least 8 characters with a letter and a number.";
  }
  if (input.password !== input.confirmPassword) {
    return "The passwords do not match.";
  }
  return null;
}
