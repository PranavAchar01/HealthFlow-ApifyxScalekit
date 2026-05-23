-- GuestFlow Database Schema
-- Run this in your Supabase SQL editor to set up the database

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Encounters table
create table if not exists encounters (
  id uuid primary key default uuid_generate_v4(),
  status text not null default 'field_capture',
  acuity text not null default 'medium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Field capture
  paramedic_id text not null,
  paramedic_name text not null,
  raw_transcript text not null,

  -- Structured data (JSON)
  structured_data jsonb,
  patient_context jsonb,
  diagnosis jsonb,
  draft_orders jsonb,
  safety_flags jsonb,
  safety_recommendation text,

  -- Nursing
  nursing_notes jsonb,
  triage_status text,
  nurse_id text,
  nurse_name text,

  -- Approval
  approved_by text,
  approved_at timestamptz,
  physician_name text,

  -- Audit
  audit_trail jsonb not null default '[]'::jsonb
);

-- Idempotent column adds for already-deployed databases
alter table encounters add column if not exists nursing_notes jsonb;
alter table encounters add column if not exists triage_status text;
alter table encounters add column if not exists nurse_id text;
alter table encounters add column if not exists nurse_name text;

-- Enable Row Level Security
alter table encounters enable row level security;

-- Policy: anyone can read (demo mode)
create policy "Allow read access" on encounters for select using (true);

-- Policy: authenticated users can insert
create policy "Allow insert" on encounters for insert with check (true);

-- Policy: authenticated users can update
create policy "Allow update" on encounters for update using (true);

-- Enable realtime
alter publication supabase_realtime add table encounters;

-- Audit log table
create table if not exists audit_log (
  id uuid primary key default uuid_generate_v4(),
  encounter_id uuid references encounters(id),
  timestamp timestamptz not null default now(),
  agent_role text not null,
  action text not null,
  details text not null,
  user_id text,
  user_name text,
  checksum text
);

alter table audit_log enable row level security;
create policy "Allow read audit" on audit_log for select using (true);
create policy "Allow insert audit" on audit_log for insert with check (true);

-- Updated at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger encounters_updated_at
  before update on encounters
  for each row
  execute function update_updated_at();
