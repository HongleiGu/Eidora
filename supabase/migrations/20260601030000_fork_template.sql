-- Fork a template into a new group-owned campaign (EID-83).
-- Atomic deep-copy of worlds + entities + relations, run as SECURITY DEFINER so
-- it can write across tables; the caller's read access is checked manually.
-- Returns the new campaign's slug.

create or replace function public.fork_template(p_template_id uuid, p_new_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_base    text;
  v_slug    text;
  v_new_id  uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Caller must be able to read the source (owner / member / public / unlisted).
  if not exists (
    select 1 from projects p
    where p.id = p_template_id and (
      p.owner_id = v_uid
      or p.visibility in ('public','unlisted')
      or exists (select 1 from project_members m where m.project_id = p.id and m.user_id = v_uid)
    )
  ) then
    raise exception 'Not allowed to fork this project' using errcode = '42501';
  end if;

  -- Unique slug from the new name + short random suffix.
  v_base := nullif(trim(both '-' from lower(regexp_replace(coalesce(p_new_name, ''), '[^a-z0-9]+', '-', 'gi'))), '');
  v_base := coalesce(v_base, 'campaign');
  loop
    v_slug := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
    exit when not exists (select 1 from projects where slug = v_slug);
  end loop;

  -- New campaign project.
  insert into projects (slug, name, owner_id, kind, forked_from, visibility)
  values (v_slug, p_new_name, v_uid, 'campaign', p_template_id, 'private')
  returning id into v_new_id;

  -- Deep-copy world(s).
  insert into worlds (project_id, slug, name, era, genre, description, timelines, content, visibility)
  select v_new_id, slug, name, era, genre, description, timelines, content, visibility
  from worlds where project_id = p_template_id;

  -- Deep-copy entities.
  insert into entities (project_id, entity_type, slug, name, visibility, content, secrets, front_matter)
  select v_new_id, entity_type, slug, name, visibility, content, secrets, front_matter
  from entities where project_id = p_template_id;

  -- Deep-copy relations.
  insert into relations (project_id, source_slug, target_slug, relation_type, attitude, two_way, note)
  select v_new_id, source_slug, target_slug, relation_type, attitude, two_way, note
  from relations where project_id = p_template_id;

  -- Creator becomes campaign admin.
  insert into project_members (project_id, user_id, role)
  values (v_new_id, v_uid, 'admin');

  return v_slug;
end;
$$;

grant execute on function public.fork_template(uuid, text) to authenticated;
