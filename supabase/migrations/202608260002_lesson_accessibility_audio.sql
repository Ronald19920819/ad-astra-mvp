create table if not exists public.lesson_accessibility_audio (
  id uuid primary key default gen_random_uuid(),
  lesson_material_id uuid not null references public.lesson_materials(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  source_type text not null check (source_type in ('pasted_text', 'pdf')),
  source_hash text not null,
  language text not null check (language in ('english', 'afrikaans')),
  voice text not null,
  transcript text,
  transcript_status text not null default 'not_prepared'
    check (transcript_status in ('not_prepared', 'generated', 'approved')),
  validation_notes text,
  approved_at timestamptz,
  approved_by uuid references public.teacher_profiles(id) on delete set null,
  audio_status text not null default 'not_generated'
    check (audio_status in ('not_generated', 'generating', 'ready', 'failed')),
  audio_segments jsonb not null default '[]'::jsonb,
  audio_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_material_id)
);

create index if not exists lesson_accessibility_audio_lesson_idx
  on public.lesson_accessibility_audio (lesson_id);

create or replace function public.set_lesson_accessibility_audio_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_lesson_accessibility_audio_updated_at
  on public.lesson_accessibility_audio;

create trigger set_lesson_accessibility_audio_updated_at
  before update on public.lesson_accessibility_audio
  for each row
  execute function public.set_lesson_accessibility_audio_updated_at();

alter table public.lesson_accessibility_audio enable row level security;

revoke all on table public.lesson_accessibility_audio from anon, authenticated;

-- No authenticated-role grants at all: every read and write goes through
-- authorized server routes (authorizeTeacher for preparation, the learner
-- accessibility-audio route for playback), which use the service-role
-- client -- matching learner_profiles.accessibility_enabled's established
-- pattern (202608260001_learner_accessibility_entitlement.sql).

comment on table public.lesson_accessibility_audio is
  'One current row per lesson reading material: its accessibility narration transcript, approval state, and generated TTS audio segments. Staleness (source changed since approval) is always computed live by comparing source_hash to the current reading content -- never cached as a boolean.';
comment on column public.lesson_accessibility_audio.source_hash is
  'sha256 of the authoritative reading content at the time the transcript was generated (lesson_materials.content_text for pasted_text, the stored PDF bytes for pdf). Compared against a freshly computed hash of the CURRENT reading to detect staleness -- never trusted as a cached "is current" flag.';
comment on column public.lesson_accessibility_audio.audio_segments is
  'Ordered array of { "index": number, "storagePath": string } objects for the lesson-audio bucket. Multiple segments exist when the narration transcript exceeds one TTS request''s input limit; the learner player advances through them in order.';

-- Private accessibility audio storage, mirroring lesson-readings
-- (202608140001_lesson_reading_pdf_storage.sql)'s bucket convention.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'lesson-audio',
  'lesson-audio',
  false,
  26214400,
  array['audio/mpeg']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No authenticated storage.objects policies are added intentionally,
-- matching lesson-readings: teachers and learners access this private
-- bucket only through authorised server routes; the service role uploads
-- generated segments and creates short-lived signed read URLs.

notify pgrst, 'reload schema';
