create extension if not exists pgcrypto;

create table if not exists public.readings (
  id uuid primary key default gen_random_uuid(),
  systolic integer not null,
  diastolic integer not null,
  pulse integer not null,
  "capturedAt" timestamptz not null default now(),
  context text not null default '',
  "contextFlags" jsonb not null default '{}'::jsonb,
  position text not null default 'Sitting',
  notes text not null default '',
  "medicationTaken" boolean not null default false,
  fasting boolean not null default false,
  "entryMethod" text not null default 'manual'
);

alter table public.readings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'readings'
      and policyname = 'Allow anon read'
  ) then
    create policy "Allow anon read"
      on public.readings
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'readings'
      and policyname = 'Allow service role write'
  ) then
    create policy "Allow service role write"
      on public.readings
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;
