-- Backfill profiles for any auth.users created before the handle_new_user
-- trigger existed (e.g. accounts from early auth testing). Idempotent.

do $$
declare
  r    record;
  base text;
  h    text;
begin
  for r in
    select u.id, u.email
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
  loop
    base := coalesce(nullif(split_part(r.email, '@', 1), ''), 'user');
    h := base;
    if exists (select 1 from public.profiles where handle = h) then
      h := base || '-' || substr(md5(r.id::text), 1, 4);
    end if;
    insert into public.profiles (id, handle, display_name)
    values (r.id, h, base)
    on conflict (id) do nothing;
  end loop;
end $$;
