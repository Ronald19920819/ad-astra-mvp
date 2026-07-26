alter table public.activity_submissions
  drop constraint if exists activity_submissions_reviewed_by_fkey;

update public.activity_submissions as submission
set reviewed_by = profile.id
from public.profiles as profile
where submission.reviewed_by = profile.auth_user_id;

update public.activity_submissions as submission
set reviewed_by = null
where reviewed_by is not null
  and not exists (
    select 1
    from public.profiles as profile
    where profile.id = submission.reviewed_by
  );

alter table public.activity_submissions
  add constraint activity_submissions_reviewed_by_fkey
  foreign key (reviewed_by)
  references public.profiles(id)
  on delete set null;
