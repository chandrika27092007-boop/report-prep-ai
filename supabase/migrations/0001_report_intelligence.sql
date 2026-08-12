-- ============================================================================
-- ArogyaOS — Medical Report Intelligence
--
-- Canonical Supabase data layer. This is the SINGLE health-data source for:
--   Medical Report Analysis → Health Baseline → Health Journey → Doctor Copilot
-- Baseline / Journey / Copilot read `health_metrics` — they never OCR again.
--
-- Ownership model:
--   auth.users (patient) → reports → health_metrics + ai_analyses
-- Every row is scoped to `patient_id` and protected by row-level security so
-- patients can only read/write their own reports.
--
-- NOTE FOR MAIN AROGYAOS INTEGRATION:
--   `patient_id` is declared as a FK to auth.users here. If the main project
--   keeps patient profiles in a separate `patients` table, repoint the FK:
--   patient_id uuid not null references patients(id) on delete cascade.
--   Keep the column name `patient_id` and the RLS `auth.uid() = patient_id`
--   policy shape unchanged — the module and its edge function depend on them.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- reports — one row per uploaded lab report (file metadata + OCR text)
-- ----------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null,
  file_type text not null default 'application/octet-stream',
  source_type text not null check (source_type in ('pdf', 'image')),
  file_size bigint not null default 0,
  storage_path text, -- path inside the private "report-files" bucket
  ocr_text text not null default '',
  status text not null default 'processing'
    check (status in ('processing', 'done', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists reports_patient_created_idx
  on public.reports (patient_id, created_at desc);

-- ----------------------------------------------------------------------------
-- health_metrics — the canonical structured metrics per report.
-- `metrics` is the shared HealthMetricsByKey document (13 metrics with
-- value / unit / reference range / status / direction / insight).
-- One row per report; `report_id` is unique so a report can never have two.
-- ----------------------------------------------------------------------------
create table if not exists public.health_metrics (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  report_id uuid not null unique references public.reports (id) on delete cascade,
  metrics jsonb not null,
  signature text not null, -- stable hash for change detection across modules
  source_text_length integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists health_metrics_patient_created_idx
  on public.health_metrics (patient_id, created_at desc);
create index if not exists health_metrics_report_idx
  on public.health_metrics (report_id);

-- ----------------------------------------------------------------------------
-- ai_analyses — patient-friendly summary, questions, and safety disclaimer
-- ----------------------------------------------------------------------------
create table if not exists public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  report_id uuid not null unique references public.reports (id) on delete cascade,
  summary text not null,
  questions jsonb not null default '[]'::jsonb,
  disclaimer text not null,
  provider text not null default 'vly-gateway',
  model text not null default 'gpt-4o-mini',
  created_at timestamptz not null default now()
);

create index if not exists ai_analyses_patient_idx
  on public.ai_analyses (patient_id);

-- ----------------------------------------------------------------------------
-- Row-level security — every table is patient-scoped
-- ----------------------------------------------------------------------------
alter table public.reports enable row level security;
alter table public.health_metrics enable row level security;
alter table public.ai_analyses enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['reports', 'health_metrics', 'ai_analyses'] loop
    execute format('drop policy if exists %I_select_own on public.%I', t, t);
    execute format('drop policy if exists %I_insert_own on public.%I', t, t);
    execute format('drop policy if exists %I_update_own on public.%I', t, t);
    execute format('drop policy if exists %I_delete_own on public.%I', t, t);

    execute format(
      'create policy %I on public.%I for select using (auth.uid() = patient_id)',
      t || '_select_own', t
    );
    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = patient_id)',
      t || '_insert_own', t
    );
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = patient_id) with check (auth.uid() = patient_id)',
      t || '_update_own', t
    );
    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = patient_id)',
      t || '_delete_own', t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Storage — private "report-files" bucket. Object paths are
-- `<patient_id>/<uuid>-<file_name>` so ownership policies can derive the owner
-- from the first path segment.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('report-files', 'report-files', false)
on conflict (id) do nothing;

drop policy if exists report_files_select_own on storage.objects;
drop policy if exists report_files_insert_own on storage.objects;
drop policy if exists report_files_update_own on storage.objects;
drop policy if exists report_files_delete_own on storage.objects;

create policy report_files_select_own on storage.objects
  for select using (
    bucket_id = 'report-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy report_files_insert_own on storage.objects
  for insert with check (
    bucket_id = 'report-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy report_files_update_own on storage.objects
  for update using (
    bucket_id = 'report-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy report_files_delete_own on storage.objects
  for delete using (
    bucket_id = 'report-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
