import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  destinationForAccountRole,
  isAccountRole,
} from "./accountRole.ts";

test("authenticated profile roles determine the destination", () => {
  assert.equal(destinationForAccountRole("teacher"), "/teacher");
  assert.equal(destinationForAccountRole("learner"), "/home");
  assert.equal(isAccountRole("teacher"), true);
  assert.equal(isAccountRole("learner"), true);
  assert.equal(isAccountRole("administrator"), false);
  assert.equal(isAccountRole(""), false);
});

test("the shared login session route does not accept a browser role", () => {
  const sessionRoute = readFileSync("app/api/auth/session/route.ts", "utf8");
  const loginPage = readFileSync("app/login/page.tsx", "utf8");

  assert.doesNotMatch(sessionRoute, /requiredRole/);
  assert.doesNotMatch(loginPage, /requiredRole/);
  assert.match(sessionRoute, /destinationForAccountRole\(profile\.role\)/);
});

test("the administrator bootstrap is service-role-only and single-admin", () => {
  const migration = readFileSync(
    "supabase/migrations/202607260003_teacher_admin_bootstrap.sql",
    "utf8",
  );
  const bootstrapScript = readFileSync(
    "scripts/bootstrap-primary-administrator.mjs",
    "utf8",
  );

  assert.match(migration, /enforce_single_administrator/);
  assert.match(migration, /AD_ASTRA_ADMINISTRATOR_ALREADY_EXISTS/);
  assert.match(
    migration,
    /revoke all on function public\.bootstrap_primary_administrator\(uuid\)[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.bootstrap_primary_administrator\(uuid\)[\s\S]*to service_role/,
  );
  assert.match(bootstrapScript, /BOOTSTRAP_ADMIN_EMAIL/);
  assert.doesNotMatch(
    bootstrapScript,
    /@gmail\.com|ronald[^"'\s]*@/i,
  );
});

test("teacher identity remains database-driven in live UI", () => {
  const liveTeacherFiles = [
    "app/teacher/page.tsx",
    "app/teacher/profile/page.tsx",
    "app/teacher/subjects/page.tsx",
    "components/teachers/AuthenticatedTeacherName.tsx",
  ];
  const content = liveTeacherFiles
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  assert.doesNotMatch(content, /Test Teacher|Ronald Petersen/);
  assert.match(content, /displayName|AuthenticatedTeacherName/);
});

test("administrator routes and server actions require the database flag", () => {
  const proxy = readFileSync("proxy.ts", "utf8");
  const teacherAuthorization = readFileSync(
    "lib/supabase/teacherAuth.ts",
    "utf8",
  );

  assert.match(proxy, /administratorRoutePrefixes/);
  assert.match(proxy, /administratorProfile\.is_administrator !== true/);
  assert.match(proxy, /redirectForRouteMismatch\("teacher", "\/teacher"\)/);
  assert.match(
    teacherAuthorization,
    /export async function authorizeAdministrator/,
  );
  assert.match(
    teacherAuthorization,
    /authorization\.teacher\.isAdministrator/,
  );
});
