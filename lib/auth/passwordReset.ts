export function getAuthenticatedPasswordResetEmail(input: {
  email: string | null | undefined;
  emailConfirmedAt: string | null | undefined;
}) {
  const email = input.email?.trim();
  return email && input.emailConfirmedAt ? email : null;
}
