-- Milestone 5: usage events, errors from the app, and deleting an account (journey J7 in docs/journeys.md).
-- Only signed-in people write here; signed-out visitors never contact the server. Nobody can read these
-- tables through the API: reports are run by the project owner in the SQL Editor.

create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null, -- kept without the person when they delete their account
  name text not null check (name in ('app_open', 'sign_in', 'school_saved', 'school_removed', 'visit_marked', 'step_done', 'sync_failed')),
  props jsonb not null default '{}' check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 1000),
  at timestamptz not null default now()
);

create table public.client_errors (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  message text not null check (length(message) <= 500),
  stack text check (length(stack) <= 4000),
  context text check (length(context) <= 200), -- where it happened: code area, page, tab
  user_agent text check (length(user_agent) <= 300),
  at timestamptz not null default now()
);

alter table public.events enable row level security;
alter table public.client_errors enable row level security;
create policy "people add their own events" on public.events for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "people add their own errors" on public.client_errors for insert to authenticated
  with check (user_id = (select auth.uid()));

revoke all on public.events, public.client_errors from anon, authenticated;
grant insert on public.events, public.client_errors to authenticated;

-- Delete my account: in one transaction, the person's households where they are the only member (with their
-- plans and everything in them), then the person. Memberships and their session go with them (on delete
-- cascade); events and errors stay without the person (on delete set null).
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  delete from public.households h
  where exists (select 1 from public.household_members m where m.household_id = h.id and m.user_id = me)
    and not exists (select 1 from public.household_members m where m.household_id = h.id and m.user_id <> me);
  delete from auth.users where id = me;
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
