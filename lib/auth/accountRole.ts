export type AccountRole = "learner" | "teacher";

export function isAccountRole(value: unknown): value is AccountRole {
  return value === "learner" || value === "teacher";
}

export function destinationForAccountRole(role: AccountRole) {
  return role === "teacher" ? "/teacher" : "/home";
}
