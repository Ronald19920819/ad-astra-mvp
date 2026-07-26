# Learner registration and onboarding setup

Phase 2B uses the existing Supabase Auth session architecture and the existing
`profiles`, `learner_profiles`, `learner_subjects`, `subjects`, and
`teacher_subjects` tables.

## Required migration

Apply the following migration manually to the Supabase project after
`202607260001_dynamic_profiles_and_learner_approvals.sql`:

```text
supabase/migrations/202607260004_learner_registration_onboarding.sql
```

The migration:

- creates a learner-only `profiles` row after a public Auth signup;
- provides authenticated, self-scoped functions for profile completion,
  pending subject requests, and subject deregistration;
- prevents the browser from choosing a role or directly granting an approved
  subject;
- preserves the existing teacher-authorised approval workflow;
- adds an own-profile read policy for `learner_profiles`.

The migration is not applied automatically by the application.

## Supabase Auth settings

1. Enable email/password signups.
2. Keep email confirmation enabled if verified email addresses are required.
3. Add the deployed application callback URL to the Supabase Auth redirect
   allow list:

   ```text
   https://YOUR-APP-DOMAIN/auth/callback
   ```

4. For local testing, also allow:

   ```text
   http://localhost:3000/auth/callback
   ```

The registration page supplies
`/auth/callback?next=/onboarding/profile` as the confirmation destination.

## Environment

No new environment variables are required. The flow uses the project's
existing Supabase public URL, anonymous key, and server-only service-role key.
The service-role key must never be exposed with a `NEXT_PUBLIC_` prefix.

## Manual verification

1. Create a learner at `/register`.
2. Confirm the learner's email and follow the callback.
3. Complete School and Grade / Stage.
4. Request one or more subjects.
5. Confirm the home page lists no unapproved subject dashboard and shows the
   requests as Pending.
6. Sign in as the authorised teacher and approve or decline each request on
   the existing Learner Approvals page.
7. Sign back in as the learner and confirm approved subjects are immediately
   available while pending or declined subjects remain inaccessible.
8. Re-request a declined subject and confirm it returns to Pending.
9. Confirm a learner cannot access a subject dashboard by entering its URL
   before approval.
10. Confirm password reset, additional subject registration, deregistration,
    and sign out work from the learner profile.
