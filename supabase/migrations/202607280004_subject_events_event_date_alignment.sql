alter table public.subject_events
  add column if not exists event_date date;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subject_events'
      and column_name = 'event_at'
  ) then
    execute $sql$
      update public.subject_events
      set event_date = coalesce(
        event_date,
        (event_at at time zone 'Africa/Johannesburg')::date
      )
      where event_date is null
    $sql$;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subject_events'
      and column_name = 'expires_on'
  ) then
    execute $sql$
      update public.subject_events
      set event_date = coalesce(event_date, expires_on)
      where event_date is null
    $sql$;
  end if;
end
$$;

alter table public.subject_events
  alter column event_date set not null;

drop index if exists subject_events_subject_event_idx;
drop index if exists subject_events_subject_expiry_idx;

create index if not exists subject_events_subject_event_date_idx
  on public.subject_events (subject_id, event_date);

alter table public.subject_events
  drop column if exists event_at,
  drop column if exists expires_on;

comment on table public.subject_events is
  'Teacher-managed subject events that store one actual event date and an optional short description.';

notify pgrst, 'reload schema';
