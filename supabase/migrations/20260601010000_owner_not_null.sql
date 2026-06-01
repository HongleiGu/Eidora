-- Tighten projects.owner_id to NOT NULL now that auth wiring sets it on create.
-- Safe: existing test data was cleared; all new projects carry an owner.

do $$ begin
  if exists (select 1 from projects where owner_id is null) then
    raise notice 'Skipping NOT NULL: % project(s) still have null owner_id',
      (select count(*) from projects where owner_id is null);
  else
    alter table projects alter column owner_id set not null;
  end if;
end $$;
