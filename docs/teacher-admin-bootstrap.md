# Primary Teacher and Administrator Bootstrap

This bootstrap connects one existing, verified Supabase Auth user to the
primary AD Astra Teacher and Administrator profile. It does not create an Auth
user and does not contain the account email address.

## Prerequisites

1. Apply `202607260001_dynamic_profiles_and_learner_approvals.sql`.
2. Apply `202607260003_teacher_admin_bootstrap.sql`.
3. In Supabase Authentication, create the real account with the Gmail address
   chosen for the primary administrator.
4. Confirm the account's email address before running the bootstrap.
5. Keep `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the local
   server environment. Never expose the service-role key in browser code.

## Run the bootstrap

From PowerShell in the project directory:

```powershell
$env:BOOTSTRAP_ADMIN_EMAIL = "the-confirmed-gmail-address"
node --env-file=.env.local scripts/bootstrap-primary-administrator.mjs
Remove-Item Env:BOOTSTRAP_ADMIN_EMAIL
```

`BOOTSTRAP_ADMIN_EMAIL` is used only to locate the existing verified Auth
account. The script sends the Auth user's UUID to a service-role-only database
function. The email address is not stored in source code or migration files.

The bootstrap creates or updates:

- profile name: Ronald Petersen;
- role: Teacher;
- teacher status: Active;
- administrator: Yes;
- active subject assignments: Business Studies, English, Afrikaans and
  History.

Running the bootstrap again for the same account is safe. If a different
administrator already exists, both the script and database trigger refuse the
operation.

## Verify

1. Sign in through `/login` with the confirmed account.
2. Confirm the server redirects to `/teacher`.
3. Open `/teacher/profile`.
4. Confirm the profile displays Ronald Petersen, initials RP, Teacher and
   Administrator, Active, and all four assigned subjects.
5. Confirm `/teacher/subjects` shows all four subject workspaces.
6. Confirm the existing development Test Teacher can still sign in and remains
   a non-administrator unless its database record already says otherwise.
