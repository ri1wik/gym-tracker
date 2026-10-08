-- Recomp: initial schema. Run once in a fresh project (SQL editor or
-- `supabase db push`). Every synced table mirrors src/domain/types.ts:
-- id, owner, created_at, updated_at, version, deleted_at plus its own
-- columns. Clients never send version or updated_at; triggers set them.
-- Row level security on every table; explicit grants to authenticated;
-- nothing to anon except the keepalive table and its RPC.

-- ---------------------------------------------------------------------------
-- Trigger functions
-- ---------------------------------------------------------------------------

create or replace function public.set_insert_stamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := 1;
  new.updated_at := now();
  if new.created_at is null then
    new.created_at := now();
  end if;
  return new;
end
$$;

create or replace function public.set_update_stamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  new.created_at := old.created_at;
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  sex text not null default 'unspecified',
  birth_date text,
  height_mm integer,
  activity_level text not null default 'light',
  goal text not null default 'recomp',
  training_age text not null default 'beginner',
  training_days_per_week integer not null default 4,
  cardio_target_s integer not null default 9000,
  protein_dg_per_kg integer not null default 20,
  calorie_override_kcal integer,
  sleep_min integer,
  week_starts_on smallint not null default 1,
  review_weekday smallint not null default 0,
  review_minute_of_day integer not null default 1080,
  checkin_interval_days integer not null default 4,
  reference_intakes text not null default 'nin',
  active_gym_profile_id uuid,
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz
);

create table if not exists public.body_weights (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date_key text not null,
  weight_g integer not null,
  waist_mm integer,
  same_conditions boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  unique (user_id, date_key)
);

create table if not exists public.photos (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  weighin_id uuid,
  date_key text not null,
  pose text not null check (pose in ('front', 'side', 'back')),
  storage_path text not null,
  thumb_path text not null,
  width integer not null,
  height integer not null,
  bytes integer not null,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  unique (user_id, date_key, pose)
);

create table if not exists public.programs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  template_key text not null,
  split text not null,
  days_per_week integer not null,
  started_on text not null,
  active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz
);

create table if not exists public.workouts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid,
  planned_on text not null,
  session_key text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null default 'in_progress',
  notes text,
  body_weight_g integer,
  plan jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz
);

create table if not exists public.workout_sets (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_id uuid not null,
  exercise_id text not null,
  set_index integer not null,
  kind text not null default 'working',
  target_reps integer,
  target_load_g integer,
  reps integer,
  load_g integer,
  assist_g integer not null default 0,
  rpe integer,
  completed_at timestamptz,
  rest_s integer,
  substituted_for text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz
);

create table if not exists public.cardio_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date_key text not null,
  kind text not null,
  started_at timestamptz not null,
  duration_s integer not null,
  distance_m integer,
  speed_m_per_h integer,
  incline_tenths_pct integer,
  effort integer,
  avg_hr integer,
  run_type text,
  handrail boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz
);

create table if not exists public.machine_settings (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  machine_id text not null,
  gym_profile_id uuid,
  seat text,
  pad text,
  grip text,
  pin text,
  foot_plate text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz
);

create table if not exists public.gym_profiles (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  machine_ids jsonb not null default '[]'::jsonb,
  custom_aliases jsonb not null default '{}'::jsonb,
  join_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz
);

-- Shared catalogue: user_id null means the seeded library, readable by everyone.
create table if not exists public.foods (
  id uuid primary key,
  user_id uuid references auth.users (id) on delete cascade,
  source text not null default 'user',
  source_id text,
  name text not null,
  name_alt jsonb not null default '[]'::jsonb,
  brand text,
  panel text not null default 'macros',
  micro_from uuid,
  n jsonb not null default '{}'::jsonb,
  nearest_generic boolean not null default false,
  licence text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz
);

create table if not exists public.portions (
  id uuid primary key,
  user_id uuid references auth.users (id) on delete cascade,
  food_id uuid not null,
  label text not null,
  grams integer not null,
  state text not null default 'as_served',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz
);

create table if not exists public.favourites (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid not null,
  portion_id uuid,
  last_grams integer not null,
  use_count integer not null default 0,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz
);

create table if not exists public.food_logs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date_key text not null,
  meal text not null,
  food_id uuid,
  recipe_id uuid,
  grams integer not null,
  n_snapshot jsonb not null default '{}'::jsonb,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Stamps, indexes, RLS and grants for every synced table
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  owned text[] := array[
    'body_weights', 'photos', 'programs', 'workouts', 'workout_sets',
    'cardio_sessions', 'machine_settings', 'gym_profiles', 'favourites', 'food_logs'
  ];
  all_tables text[] := array[
    'profiles', 'body_weights', 'photos', 'programs', 'workouts', 'workout_sets',
    'cardio_sessions', 'machine_settings', 'gym_profiles', 'foods', 'portions',
    'favourites', 'food_logs'
  ];
begin
  foreach t in array all_tables loop
    execute format('drop trigger if exists %I on public.%I', t || '_insert_stamps', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public.set_insert_stamps()', t || '_insert_stamps', t);
    execute format('drop trigger if exists %I on public.%I', t || '_update_stamps', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_update_stamps()', t || '_update_stamps', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;

  -- Owned through user_id: one policy per operation in the (select auth.uid()) form.
  foreach t in array owned loop
    execute format('create index if not exists %I on public.%I (user_id, updated_at)', t || '_user_updated_idx', t);
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete_own', t);
  end loop;
end
$$;

-- profiles: owned through id.
create index if not exists profiles_updated_idx on public.profiles (updated_at);
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles for delete to authenticated using ((select auth.uid()) = id);

-- foods and portions: the seeded catalogue (user_id null) is readable by every signed-in user; own rows are writable.
create index if not exists foods_updated_idx on public.foods (updated_at);
create index if not exists foods_user_updated_idx on public.foods (user_id, updated_at);
drop policy if exists foods_select_shared on public.foods;
create policy foods_select_shared on public.foods for select to authenticated using (user_id is null or (select auth.uid()) = user_id);
drop policy if exists foods_insert_own on public.foods;
create policy foods_insert_own on public.foods for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists foods_update_own on public.foods;
create policy foods_update_own on public.foods for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists foods_delete_own on public.foods;
create policy foods_delete_own on public.foods for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists portions_updated_idx on public.portions (updated_at);
create index if not exists portions_food_idx on public.portions (food_id);
drop policy if exists portions_select_shared on public.portions;
create policy portions_select_shared on public.portions for select to authenticated using (user_id is null or (select auth.uid()) = user_id);
drop policy if exists portions_insert_own on public.portions;
create policy portions_insert_own on public.portions for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists portions_update_own on public.portions;
create policy portions_update_own on public.portions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists portions_delete_own on public.portions;
create policy portions_delete_own on public.portions for delete to authenticated using ((select auth.uid()) = user_id);

-- Query indexes beyond the pull cursor.
create index if not exists body_weights_user_date_idx on public.body_weights (user_id, date_key);
create index if not exists food_logs_user_date_idx on public.food_logs (user_id, date_key);
create index if not exists cardio_sessions_user_date_idx on public.cardio_sessions (user_id, date_key);
create index if not exists workout_sets_workout_idx on public.workout_sets (workout_id);
create index if not exists workouts_user_planned_idx on public.workouts (user_id, planned_on);
create index if not exists photos_weighin_idx on public.photos (weighin_id);
create index if not exists favourites_user_food_idx on public.favourites (user_id, food_id);

-- ---------------------------------------------------------------------------
-- New user: a profiles row on signup
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do nothing;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Delete account: removes the auth user; every table cascades. The client
-- removes the user's storage objects first (deleting storage.objects rows
-- by SQL would leave the files behind).
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
  delete from auth.users where id = auth.uid();
end
$$;

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Keepalive: the only thing anon may touch. A one-row table the GitHub
-- Actions ping reads or touches so the free project counts as active.
-- ---------------------------------------------------------------------------

create table if not exists public.keepalive (
  id integer primary key default 1 check (id = 1),
  touched_at timestamptz not null default now(),
  touches bigint not null default 0
);

insert into public.keepalive (id) values (1) on conflict (id) do nothing;

alter table public.keepalive enable row level security;
drop policy if exists keepalive_read on public.keepalive;
create policy keepalive_read on public.keepalive for select to anon, authenticated using (true);
grant select on table public.keepalive to anon, authenticated;

create or replace function public.keepalive_touch()
returns timestamptz
language sql
security definer
set search_path = ''
as $$
  update public.keepalive
  set touched_at = now(), touches = touches + 1
  where id = 1
  returning touched_at;
$$;

revoke all on function public.keepalive_touch() from public;
grant execute on function public.keepalive_touch() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: one private bucket, path prefix = user id
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 2097152, array['image/jpeg'])
on conflict (id) do update set public = false;

drop policy if exists photos_select_own on storage.objects;
create policy photos_select_own on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists photos_insert_own on storage.objects;
create policy photos_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists photos_update_own on storage.objects;
create policy photos_update_own on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists photos_delete_own on storage.objects;
create policy photos_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
