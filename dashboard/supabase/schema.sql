-- ============================================================
-- RunBook SaaS — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. INCIDENTS
-- Written by the RunBook agent (via MCP/Cloud Run) after each investigation.
create table if not exists public.incidents (
  id                   text primary key,          -- e.g. "INC-DEMO-003"
  service_name         text not null,
  severity             text not null default 'P3',-- P1/P2/P3
  action_taken         text not null,             -- AUTO_REMEDIATED | SHADOW_LOGGED | ESCALATED
  confidence_score     numeric not null default 0,
  anomaly_score        numeric not null default 0,
  narrative            text,                      -- full Chronicle narrative text
  esql_query           text,                      -- the ES|QL blast-radius query that ran
  confidence_factors   jsonb,                     -- [{label, score, weight}, ...]
  dna_match_id         text,                      -- matched past incident ID
  dna_similarity       numeric,                   -- 0–100
  mttr_seconds         integer,                   -- agent resolution time
  human_mttr_minutes   integer,                   -- historical human benchmark
  workspace_id         uuid references auth.users(id) on delete cascade,
  created_at           timestamptz not null default now()
);

-- RLS: each user only sees their own workspace incidents
alter table public.incidents enable row level security;

create policy "Users see their own incidents"
  on public.incidents for all
  using (workspace_id = auth.uid());


-- 2. SHADOW ACTIONS
-- One row per alert the agent evaluated while Shadow Mode is on.
create table if not exists public.shadow_actions (
  id               uuid primary key default gen_random_uuid(),
  incident_id      text not null,
  service_name     text,
  agent_action     text not null,        -- what the agent would have done
  human_action     text,                 -- filled in after engineer resolves
  agent_reasoning  text,
  human_reasoning  text,
  agreed           boolean,             -- set to true/false when human_action is recorded
  workspace_id     uuid references auth.users(id) on delete cascade,
  created_at       timestamptz not null default now()
);

alter table public.shadow_actions enable row level security;

create policy "Users see their own shadow actions"
  on public.shadow_actions for all
  using (workspace_id = auth.uid());


-- 3. DNA INDEX
-- Each row = one resolved incident fingerprint (vector embedding stored in Elastic,
-- metadata stored here for the dashboard).
create table if not exists public.dna_index (
  id                    uuid primary key default gen_random_uuid(),
  origin_incident_id    text not null,
  service_name          text not null,
  resolution_action     text not null,
  human_mttr_minutes    integer,
  similar_count         integer not null default 0,
  embedding_id          text,           -- Elastic document ID for the vector
  workspace_id          uuid references auth.users(id) on delete cascade,
  created_at            timestamptz not null default now()
);

alter table public.dna_index enable row level security;

create policy "Users see their own DNA index"
  on public.dna_index for all
  using (workspace_id = auth.uid());


-- 4. RUNBOOKS
-- Metadata for uploaded runbook documents (chunks stored in Elastic).
create table if not exists public.runbooks (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  tags         text[] not null default '{}',
  chunk_count  integer not null default 0,
  status       text not null default 'embedded', -- embedded | pending | error
  workspace_id uuid references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

alter table public.runbooks enable row level security;

create policy "Users see their own runbooks"
  on public.runbooks for all
  using (workspace_id = auth.uid());


-- 5. WORKSPACE SETTINGS
-- One row per user, stores Elastic credentials and agent config.
create table if not exists public.workspace_settings (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  elastic_url         text,
  elastic_api_key     text,           -- NOTE: encrypt this with Supabase Vault in prod
  confidence_threshold integer not null default 85,
  shadow_mode         boolean not null default true,
  razorpay_sub_id     text,
  plan                text not null default 'trial',  -- trial | pro
  trial_ends_at       timestamptz default (now() + interval '14 days'),
  updated_at          timestamptz not null default now()
);

alter table public.workspace_settings enable row level security;

create policy "Users manage their own settings"
  on public.workspace_settings for all
  using (user_id = auth.uid());

-- Auto-create a settings row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.workspace_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
