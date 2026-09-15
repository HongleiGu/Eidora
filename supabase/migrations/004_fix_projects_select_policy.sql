-- Fix: projects_select routed through can_read_project(id), which re-queries the
-- projects table. During INSERT ... RETURNING (return=representation, used by
-- createProject's .insert().select()), that self-referential subquery can't see
-- the new row, so Postgres raises 42501. Inline the checks against the row's own
-- columns instead — no self-query, so the returned row is visible.

drop policy if exists projects_select on projects;
create policy projects_select on projects for select using (
  owner_id = auth.uid()
  or visibility in ('public','unlisted')
  or exists (
    select 1 from project_members m
    where m.project_id = id and m.user_id = auth.uid()
  )
);

-- can_read_project() is still used by worlds/entities/relations SELECT policies,
-- where it queries a DIFFERENT table (projects) than the row being returned, so
-- those have no self-reference problem and are left as-is.
