-- v1 accounts. A household owns a plan per admissions cycle; people belong to households.
-- Every table has row-level security: a signed-in person can only reach their own household's rows.
-- See docs/journeys.md for what each table is for.

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My household' check (length(name) <= 80),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_id on public.household_members (user_id);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  cycle text not null check (cycle ~ '^\d{4}$'),
  schema_version int not null default 1,
  home text not null default '' check (length(home) <= 32),
  max_miles numeric not null default 1.5 check (max_miles > 0 and max_miles <= 10),
  need_subway boolean not null default false,
  skip_competitive boolean not null default false,
  weights jsonb not null default '{"distance": 2, "scores": 1, "safety": 2, "bullying": 1, "teachers": 1}',
  programs text[] not null default '{}' check (cardinality(programs) <= 20),
  data_seen_as_of date,
  updated_at timestamptz not null default now(),
  unique (household_id, cycle)
);

-- One row per saved school, visit, finished step and school note. IDs match data/*.json.
create table public.saved_schools (
  plan_id uuid not null references public.plans (id) on delete cascade,
  dbn text not null check (dbn ~ '^\d{2}[KMQRX]\d{3}$'),
  rank int not null check (rank > 0),
  primary key (plan_id, dbn)
);

create table public.visits (
  plan_id uuid not null references public.plans (id) on delete cascade,
  event_id text not null check (length(event_id) <= 64),
  going boolean not null default false,
  attended boolean not null default false,
  primary key (plan_id, event_id)
);

create table public.step_progress (
  plan_id uuid not null references public.plans (id) on delete cascade,
  step_id text not null check (length(step_id) <= 16),
  done_at timestamptz not null default now(),
  primary key (plan_id, step_id)
);

create table public.school_notes (
  plan_id uuid not null references public.plans (id) on delete cascade,
  dbn text not null check (dbn ~ '^\d{2}[KMQRX]\d{3}$'),
  rating smallint not null default 0 check (rating between 0 and 5),
  pros text[] not null default '{}' check (cardinality(pros) <= 50),
  cons text[] not null default '{}' check (cardinality(cons) <= 50),
  updated_at timestamptz not null default now(), -- set by the app, so the newer note wins when two devices merge
  primary key (plan_id, dbn)
);

-- Where each person left off. Per person, not per household: two parents each resume their own place.
create table public.user_session (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  last_tab text check (length(last_tab) <= 16),
  last_dbn text check (length(last_dbn) <= 8),
  last_view text check (length(last_view) <= 32),
  updated_at timestamptz not null default now()
);

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger plans_updated_at before update on public.plans for each row execute function public.touch_updated_at();
create trigger user_session_updated_at before update on public.user_session for each row execute function public.touch_updated_at();

-- Access helpers. security definer so the policies can look up membership without recursing into its own policy.
create function public.is_household_member(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.household_members m where m.household_id = h and m.user_id = (select auth.uid()))
$$;

create function public.can_edit_plan(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.plans pl join public.household_members m on m.household_id = pl.household_id
    where pl.id = p and m.user_id = (select auth.uid()))
$$;

-- The one way in: returns the signed-in person's plan for a cycle, creating their household and plan the first time.
create function public.open_plan(p_cycle text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  h uuid;
  pid uuid;
begin
  if uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if p_cycle !~ '^\d{4}$' then raise exception 'Bad cycle %', p_cycle using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text)); -- two tabs signing in at once must not make two households
  select m.household_id into h from public.household_members m where m.user_id = uid order by m.created_at limit 1;
  if h is null then
    insert into public.households default values returning id into h;
    insert into public.household_members (household_id, user_id, role) values (h, uid, 'owner');
  end if;
  select id into pid from public.plans where household_id = h and cycle = p_cycle;
  if pid is null then
    insert into public.plans (household_id, cycle) values (h, p_cycle) returning id into pid;
  end if;
  return pid;
end $$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.plans enable row level security;
alter table public.saved_schools enable row level security;
alter table public.visits enable row level security;
alter table public.step_progress enable row level security;
alter table public.school_notes enable row level security;
alter table public.user_session enable row level security;

create policy "members read their household" on public.households for select to authenticated using (public.is_household_member(id));
create policy "members rename their household" on public.households for update to authenticated
  using (public.is_household_member(id)) with check (public.is_household_member(id));

-- Joining a household happens only through open_plan (and invites, later), never by inserting a row.
create policy "members see who is in their household" on public.household_members for select to authenticated
  using (public.is_household_member(household_id));

create policy "members read their plan" on public.plans for select to authenticated using (public.is_household_member(household_id));
create policy "members change their plan" on public.plans for update to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

create policy "members manage saved schools" on public.saved_schools for all to authenticated
  using (public.can_edit_plan(plan_id)) with check (public.can_edit_plan(plan_id));
create policy "members manage visits" on public.visits for all to authenticated
  using (public.can_edit_plan(plan_id)) with check (public.can_edit_plan(plan_id));
create policy "members manage steps" on public.step_progress for all to authenticated
  using (public.can_edit_plan(plan_id)) with check (public.can_edit_plan(plan_id));
create policy "members manage notes" on public.school_notes for all to authenticated
  using (public.can_edit_plan(plan_id)) with check (public.can_edit_plan(plan_id));

create policy "people manage their own session" on public.user_session for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Signed-out visitors (the anon role) get nothing. Signed-in people get only what the policies allow.
revoke all on public.households, public.household_members, public.plans, public.saved_schools, public.visits,
  public.step_progress, public.school_notes, public.user_session from anon;
revoke execute on function public.open_plan(text), public.is_household_member(uuid), public.can_edit_plan(uuid),
  public.touch_updated_at() from public, anon;
grant execute on function public.open_plan(text), public.is_household_member(uuid), public.can_edit_plan(uuid) to authenticated;
