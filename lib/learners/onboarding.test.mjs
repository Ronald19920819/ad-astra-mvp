import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canRequestLearnerSubject,
  learnerOnboardingDestination,
  learnerRegistrationError,
} from "./onboarding.ts";

test("learner onboarding routes follow profile and request completion", () => {
  assert.equal(
    learnerOnboardingDestination({
      hasLearnerProfile: false,
      profileComplete: false,
      hasAnySubjectRequest: false,
    }),
    "/onboarding/profile",
  );
  assert.equal(
    learnerOnboardingDestination({
      hasLearnerProfile: true,
      profileComplete: true,
      hasAnySubjectRequest: false,
    }),
    "/onboarding/subjects",
  );
  assert.equal(
    learnerOnboardingDestination({
      hasLearnerProfile: true,
      profileComplete: true,
      hasAnySubjectRequest: true,
    }),
    "/home",
  );
});

test("only available, declined, or inactive subjects can be requested", () => {
  assert.equal(canRequestLearnerSubject(null), true);
  assert.equal(canRequestLearnerSubject("declined"), true);
  assert.equal(canRequestLearnerSubject("inactive"), true);
  assert.equal(canRequestLearnerSubject("pending"), false);
  assert.equal(canRequestLearnerSubject("approved"), false);
});

test("learner registration validates identity and password confirmation", () => {
  assert.equal(
    learnerRegistrationError({
      firstName: "Ada",
      surname: "Petersen",
      email: "ada@example.com",
      password: "Secure123",
      confirmPassword: "Secure123",
    }),
    null,
  );
  assert.match(
    learnerRegistrationError({
      firstName: "Ada",
      surname: "Petersen",
      email: "ada@example.com",
      password: "short",
      confirmPassword: "short",
    }),
    /8 characters/,
  );
  assert.match(
    learnerRegistrationError({
      firstName: "Ada",
      surname: "Petersen",
      email: "ada@example.com",
      password: "Secure123",
      confirmPassword: "Different123",
    }),
    /do not match/,
  );
});

test("database onboarding can create only learner profiles and pending requests", () => {
  const migration = readFileSync(
    "supabase/migrations/202607260004_learner_registration_onboarding.sql",
    "utf8",
  );

  assert.match(migration, /'learner'\s*\)\s*on conflict/);
  assert.doesNotMatch(
    migration,
    /raw_user_meta_data\s*->>\s*'role'/,
  );
  assert.match(migration, /request_own_learner_subjects/);
  assert.match(migration, /profiles\.auth_user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /'pending'/);
  assert.match(migration, /is_active[\s\S]*false/);
  assert.match(
    migration,
    /grant execute on function public\.request_own_learner_subjects\(uuid\[\]\)[\s\S]*to authenticated/,
  );
});

test("subject dashboards require approved active enrolments in the proxy", () => {
  const proxy = readFileSync("proxy.ts", "utf8");

  assert.match(proxy, /learnerSubjectRouteRequirements/);
  assert.match(proxy, /\.eq\("status", "approved"\)/);
  assert.match(proxy, /\.eq\("is_active", true\)/);
  assert.match(proxy, /redirectAuthenticatedLearner\("\/subjects"\)/);
});

test("public registration exposes learner signup only", () => {
  const login = readFileSync("app/login/page.tsx", "utf8");
  const registration = readFileSync("app/register/page.tsx", "utf8");

  assert.match(login, /Create Learner Account/);
  assert.doesNotMatch(login, /Teacher Sign Up|Create Teacher/);
  assert.doesNotMatch(
    registration,
    /Teacher Sign Up|Create Teacher|Create Administrator|role\s*:/i,
  );
});
