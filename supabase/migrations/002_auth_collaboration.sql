-- Auth & Collaboration (EID-79 epic, EID-81)
-- Adds: profiles, project ownership/kind/fork/visibility, project_members, real RLS.
-- Idempotent: safe to re-run. Existing test data is cleared separately (one-time).

-- ── profiles (mirror of auth.users) ───────────────────────────────────────────

create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  handle       text unique not null,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_handle text := coalesce(nullif(split_part(new.email, '@', 1), ''), 'user');
begin
  begin
    insert into public.profiles (id, handle, display_name)
    values (new.id, base_handle, base_handle);
  exception when unique_violation then
    insert into public.profiles (id, handle, display_name)
    values (new.id, base_handle || '-' || substr(md5(new.id::text), 1, 4), base_handle)
    on conflict (id) do nothing;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── projects: ownership, kind, fork lineage, visibility ───────────────────────
-- owner_id is nullable for now; tightened to NOT NULL once auth wiring lands.

alter table projects add column if not exists owner_id    uuid references profiles(id) on delete set null;
alter table projects add column if not exists kind        text not null default 'template';
alter table projects add column if not exists forked_from uuid references projects(id) on delete set null;
alter table projects add column if not exists visibility  text not null default 'private';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'projects_kind_check') then
    alter table projects add constraint projects_kind_check check (kind in ('template','campaign'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_visibility_check') then
    alter table projects add constraint projects_visibility_check check (visibility in ('private','unlisted','public'));
  end if;
end $$;

create index if not exists projects_owner on projects(owner_id);
create index if not exists projects_forked_from on projects(forked_from);

-- ── project_members ───────────────────────────────────────────────────────────

create table if not exists project_members (
  project_id uuid not null references projects(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       text not null default 'player',
  added_at   timestamptz not null default now(),
  primary key (project_id, user_id),
  constraint project_members_role_check check (role in ('admin','gm','player'))
);

create index if not exists project_members_user on project_members(user_id);

-- ── Access-check helpers (SECURITY DEFINER → bypass RLS, prevent recursion) ───

create or replace function public.can_read_project(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from projects p where p.id = pid and (
      p.owner_id = auth.uid()
      or p.visibility in ('public','unlisted')
      or exists (select 1 from project_members m where m.project_id = pid and m.user_id = auth.uid())
    )
  );
$$;

create or replace function public.is_project_member(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from projects p where p.id = pid and p.owner_id = auth.uid())
      or exists (select 1 from project_members m where m.project_id = pid and m.user_id = auth.uid());
$$;

create or replace function public.is_project_editor(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from projects p where p.id = pid and p.owner_id = auth.uid())
      or exists (select 1 from project_members m where m.project_id = pid and m.user_id = auth.uid() and m.role in ('admin','gm'));
$$;

create or replace function public.is_project_admin(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from projects p where p.id = pid and p.owner_id = auth.uid())
      or exists (select 1 from project_members m where m.project_id = pid and m.user_id = auth.uid() and m.role = 'admin');
$$;

create or replace function public.is_session_member(sid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from sessions s where s.id = sid and public.is_project_member(s.project_id));
$$;

-- ── RLS: drop the old allow_all, install real policies ────────────────────────

alter table profiles        enable row level security;
alter table project_members enable row level security;

do $$
declare t text;
begin
  foreach t in array array['projects','worlds','entities','relations',
                           'sessions','session_state','session_flags','session_log'] loop
    execute format('drop policy if exists "allow_all" on %I', t);
  end loop;
end $$;

-- profiles
drop policy if exists profiles_select on profiles;
drop policy if exists profiles_write  on profiles;
create policy profiles_select on profiles for select using (true);
create policy profiles_write  on profiles for all using (id = auth.uid()) with check (id = auth.uid());

-- projects
drop policy if exists projects_select on projects;
drop policy if exists projects_insert on projects;
drop policy if exists projects_update on projects;
drop policy if exists projects_delete on projects;
create policy projects_select on projects for select using (can_read_project(id));
create policy projects_insert on projects for insert with check (owner_id = auth.uid());
create policy projects_update on projects for update using (is_project_admin(id)) with check (is_project_admin(id));
create policy projects_delete on projects for delete using (is_project_admin(id));

-- project_members
drop policy if exists members_select on project_members;
drop policy if exists members_write  on project_members;
create policy members_select on project_members for select using (is_project_member(project_id));
create policy members_write  on project_members for all using (is_project_admin(project_id)) with check (is_project_admin(project_id));

-- worlds / entities / relations  (read = can_read_project, write = editor)
do $$
declare t text;
begin
  foreach t in array array['worlds','entities','relations'] loop
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_insert', t);
    execute format('drop policy if exists %I on %I', t || '_update', t);
    execute format('drop policy if exists %I on %I', t || '_delete', t);
    execute format('create policy %I on %I for select using (can_read_project(project_id))', t || '_select', t);
    execute format('create policy %I on %I for insert with check (is_project_editor(project_id))', t || '_insert', t);
    execute format('create policy %I on %I for update using (is_project_editor(project_id)) with check (is_project_editor(project_id))', t || '_update', t);
    execute format('create policy %I on %I for delete using (is_project_editor(project_id))', t || '_delete', t);
  end loop;
end $$;

-- sessions  (members read/write; only editors delete)
drop policy if exists sessions_select on sessions;
drop policy if exists sessions_insert on sessions;
drop policy if exists sessions_update on sessions;
drop policy if exists sessions_delete on sessions;
create policy sessions_select on sessions for select using (is_project_member(project_id));
create policy sessions_insert on sessions for insert with check (is_project_member(project_id));
create policy sessions_update on sessions for update using (is_project_member(project_id)) with check (is_project_member(project_id));
create policy sessions_delete on sessions for delete using (is_project_editor(project_id));

-- session_state / session_flags / session_log  (scoped via session → project)
do $$
declare t text;
begin
  foreach t in array array['session_state','session_flags','session_log'] loop
    execute format('drop policy if exists %I on %I', t || '_all', t);
    execute format('create policy %I on %I for all using (is_session_member(session_id)) with check (is_session_member(session_id))', t || '_all', t);
  end loop;
end $$;
