-- Recomp: second migration. Run after 0001_init.sql (SQL editor or
-- `supabase db push`). Idempotent: every function is replaced in place and
-- every grant statement is safe to repeat.
--
-- 1. deleted_at and finished_at are one-way on the server too. A client
--    upsert that carries null over a non-null value (a stale copy pushing
--    after another device finished or deleted the row) no longer wins:
--    PostgREST's ON CONFLICT DO UPDATE runs the before-update trigger, and
--    the trigger keeps the old value. The client merge (src/data/sync) keeps
--    the same rule; this is the last belt.
-- 2. delete_my_account refuses while the user's photos are still in the
--    bucket, so an auth user is never cascaded past files nobody could
--    delete afterwards (the client removes the files first and stops on
--    any storage error).
-- 3. The grant model the header of 0001 promises: anon holds select on
--    keepalive and execute on keepalive_touch, nothing else. The keepalive
--    table was created after the revoke loop and kept the platform's
--    default grants; the trigger functions kept default execute.

-- ---------------------------------------------------------------------------
-- 1. Monotone fields
-- ---------------------------------------------------------------------------

create or replace function public.set_update_stamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  new.created_at := old.created_at;
  new.deleted_at := coalesce(old.deleted_at, new.deleted_at);
  return new;
end
$$;

create or replace function public.set_workout_monotone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.finished_at is not null and new.finished_at is null then
    new.finished_at := old.finished_at;
    if new.status = 'in_progress' then
      new.status := old.status;
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists workouts_monotone on public.workouts;
create trigger workouts_monotone
  before update on public.workouts
  for each row execute function public.set_workout_monotone();

-- ---------------------------------------------------------------------------
-- 2. Delete account only once the bucket prefix is empty
-- ---------------------------------------------------------------------------

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if exists (
    select 1 from storage.objects
    where bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text
  ) then
    raise exception 'photos still present';
  end if;
  delete from auth.users where id = auth.uid();
end
$$;

revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Grants: nothing to anon beyond keepalive
-- ---------------------------------------------------------------------------

revoke all on table public.keepalive from public, anon, authenticated;
grant select on table public.keepalive to anon, authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_insert_stamps() from public, anon, authenticated;
revoke all on function public.set_update_stamps() from public, anon, authenticated;
revoke all on function public.set_workout_monotone() from public, anon, authenticated;

revoke all on function public.keepalive_touch() from public, anon, authenticated;
grant execute on function public.keepalive_touch() to anon, authenticated;
