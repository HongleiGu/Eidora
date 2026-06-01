-- Eidora database schema
-- Run once via: pnpm tsx --env-file=.env scripts/setup-db.ts
-- Or paste into Supabase SQL Editor

-- ── Projects ──────────────────────────────────────────────────────────────────

create table if not exists projects (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  schema_version int not null default 1,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Worlds ────────────────────────────────────────────────────────────────────

create table if not exists worlds (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  slug         text not null,
  name         text not null,
  era          text,
  genre        text[]        not null default '{}',
  description  text,
  timelines    jsonb         not null default '[]',
  content      text          not null default '',
  visibility   text          not null default 'public',
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now(),
  constraint worlds_visibility_check check (visibility in ('public','gm_only','author_only')),
  unique(project_id, slug)
);

-- ── Entities ──────────────────────────────────────────────────────────────────
-- Covers: character, location, artifact, lore, document, scenario
-- Type-specific fields live in front_matter (jsonb).

create table if not exists entities (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  entity_type  text not null,
  slug         text not null,
  name         text not null,
  visibility   text not null default 'public',
  content      text not null default '',
  secrets      text not null default '',
  front_matter jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint entities_type_check check (
    entity_type in ('character','location','artifact','lore','document','scenario')
  ),
  constraint entities_visibility_check check (
    visibility in ('public','gm_only','author_only')
  ),
  unique(project_id, entity_type, slug)
);

create index if not exists entities_project_type on entities(project_id, entity_type);
create index if not exists entities_project_slug on entities(project_id, slug);

-- ── Relations ─────────────────────────────────────────────────────────────────

create table if not exists relations (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  source_slug   text not null,
  target_slug   text not null,
  relation_type text not null,
  attitude      int  check (attitude between -100 and 100),
  two_way       boolean not null default false,
  note          text,
  created_at    timestamptz not null default now(),
  unique(project_id, source_slug, target_slug, relation_type)
);

create index if not exists relations_source on relations(project_id, source_slug);
create index if not exists relations_target on relations(project_id, target_slug);

-- ── Sessions ──────────────────────────────────────────────────────────────────

create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  scenario_slug text not null,
  name          text not null,
  player        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Entity-level overrides for a session (diffs on top of base entities)
create table if not exists session_state (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions(id) on delete cascade,
  entity_type  text not null,
  entity_slug  text not null,
  overrides    jsonb not null default '{}',
  unique(session_id, entity_type, entity_slug)
);

-- Boolean / string game flags
create table if not exists session_flags (
  session_id uuid not null references sessions(id) on delete cascade,
  key        text not null,
  value      text not null,
  primary key (session_id, key)
);

-- Conversation / play transcript
create table if not exists session_log (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  role       text not null,
  content    text not null,
  created_at timestamptz not null default now(),
  constraint session_log_role_check check (role in ('player','agent','narrator','system'))
);

create index if not exists session_log_session on session_log(session_id, created_at);

-- ── RLS (open for now — tighten when auth is added) ───────────────────────────

alter table projects    enable row level security;
alter table worlds      enable row level security;
alter table entities    enable row level security;
alter table relations   enable row level security;
alter table sessions    enable row level security;
alter table session_state enable row level security;
alter table session_flags enable row level security;
alter table session_log enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'projects','worlds','entities','relations',
    'sessions','session_state','session_flags','session_log'
  ] loop
    if not exists (
      select 1 from pg_policies
      where tablename = tbl and policyname = 'allow_all'
    ) then
      execute format(
        'create policy "allow_all" on %I for all using (true) with check (true)',
        tbl
      );
    end if;
  end loop;
end;
$$;
