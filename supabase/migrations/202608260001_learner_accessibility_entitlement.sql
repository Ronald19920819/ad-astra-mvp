alter table public.learner_profiles
  add column if not exists accessibility_enabled boolean not null default false;

comment on column public.learner_profiles.accessibility_enabled is
  'Global, admin-granted accessibility entitlement for this learner across every subject. Never stores a diagnosis or reason. learner_profiles already has insert/update/delete revoked from the authenticated role (see 202607260004_learner_registration_onboarding.sql), so all mutation must go through the service-role administrator API path (lib/supabase/teacherAuth.ts authorizeAdministrator) -- no additional RLS policy is required for this column.';

notify pgrst, 'reload schema';
