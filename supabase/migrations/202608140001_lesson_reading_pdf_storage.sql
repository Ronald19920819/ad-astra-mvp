-- Private lesson PDF storage. Application routes issue narrowly scoped signed
-- upload/read access after checking teacher assignment or learner enrolment.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'lesson-readings',
  'lesson-readings',
  false,
  26214400,
  array['application/pdf']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No authenticated storage.objects policies are added intentionally. Teachers
-- and learners access this private bucket only through authorised server routes;
-- the service role creates single-object upload tokens and short-lived read URLs.
