-- Usage counts from every visit, signed in or not (docs/privacy.md, docs/journeys.md "Events we log"), and the
-- owner's reports on them (docs/operations.md "Usage reports").
--
-- Signed-out visitors add events and errors with no user: no cookie, and no ID that links one visit to the next.
-- `visit` is a random ID made fresh on each page load and kept only in memory, so a report can say "in one visit".
-- Nobody can read any of it through the API; the reports are views in the `reports` schema, which the API
-- doesn't serve and only the database owner can read (Supabase SQL Editor).

alter table public.events add column visit uuid;
alter table public.events drop constraint events_name_check;
alter table public.events add constraint events_name_check check (name in (
  'app_open', 'sign_in', 'sync_failed',
  'tab_view', 'school_opened', 'school_saved', 'school_removed', 'preference_set',
  'going_marked', 'visit_marked', 'note_added', 'step_done',
  'list_view', 'list_copied', 'feedback_sent'));
create index events_at on public.events (at);
create index client_errors_at on public.client_errors (at);

create policy "visitors add events without a user" on public.events for insert to anon with check (user_id is null);
create policy "visitors add errors without a user" on public.client_errors for insert to anon with check (user_id is null);
grant insert (name, props, visit) on public.events to anon;
grant insert (message, stack, context, user_agent) on public.client_errors to anon;

-- Limits: per person as before, and for signed-out visitors all together (they have no user to count by):
-- 20,000 events and 500 errors an hour. A busy evening in season is a few thousand events.
create or replace function public.limit_logs() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n bigint;
begin
  if new.user_id is null then
    execute format('select count(*) from public.%I where user_id is null and at > now() - interval ''1 hour''', tg_table_name) into n;
    if n >= tg_argv[1]::bigint then
      raise exception 'Too many % rows this hour', tg_table_name using errcode = '54000';
    end if;
  else
    execute format('select count(*) from public.%I where user_id = $1 and at > now() - interval ''1 hour''', tg_table_name)
      into n using new.user_id;
    if n >= tg_argv[0]::bigint then
      raise exception 'Too many % rows this hour', tg_table_name using errcode = '54000';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.limit_logs() from public, anon, authenticated;
drop trigger limit_events on public.events;
drop trigger limit_client_errors on public.client_errors;
create trigger limit_events before insert on public.events for each row execute function public.limit_logs('1000', '20000');
create trigger limit_client_errors before insert on public.client_errors for each row execute function public.limit_logs('100', '500');

-- ---------------- Reports (owner only) ----------------
-- Days are New York days. "Visits" are page loads; "people" are signed-in accounts.
create schema reports;
revoke all on schema reports from public, anon, authenticated;

-- One row per day for the last 90 days: activity and engagement.
create view reports.daily as
with ev as (
  select (e.at at time zone 'America/New_York')::date as day,
    count(distinct e.visit) filter (where e.name = 'app_open') as visits,
    count(distinct e.visit) filter (where e.name = 'app_open' and e.user_id is not null) as signed_in_visits,
    count(distinct e.user_id) as people_signed_in,
    count(*) filter (where e.name = 'sign_in') as sign_ins,
    count(*) filter (where e.name = 'tab_view') as tab_views,
    count(*) filter (where e.name = 'school_opened') as schools_opened,
    count(*) filter (where e.name = 'school_saved') as schools_saved,
    count(*) filter (where e.name = 'school_removed') as schools_removed,
    count(*) filter (where e.name = 'going_marked') as open_houses_planned,
    count(*) filter (where e.name = 'visit_marked') as open_houses_visited,
    count(*) filter (where e.name = 'note_added') as notes_added,
    count(*) filter (where e.name = 'step_done') as steps_done,
    count(*) filter (where e.name = 'list_copied') as lists_copied,
    count(*) filter (where e.name = 'step_done' and e.props ->> 'step_id' = 's7') as marked_submitted,
    count(*) filter (where e.name = 'feedback_sent') as feedback_sent,
    count(*) filter (where e.name = 'sync_failed') as failed_saves
  from public.events e where e.at > now() - interval '90 days' group by 1),
er as (
  select (at at time zone 'America/New_York')::date as day, count(*) as errors
  from public.client_errors where at > now() - interval '90 days' group by 1)
select coalesce(ev.day, er.day) as day,
  coalesce(visits, 0) as visits, coalesce(signed_in_visits, 0) as signed_in_visits,
  coalesce(people_signed_in, 0) as people_signed_in, coalesce(sign_ins, 0) as sign_ins,
  coalesce(tab_views, 0) as tab_views, coalesce(schools_opened, 0) as schools_opened,
  coalesce(schools_saved, 0) as schools_saved, coalesce(schools_removed, 0) as schools_removed,
  coalesce(open_houses_planned, 0) as open_houses_planned, coalesce(open_houses_visited, 0) as open_houses_visited,
  coalesce(notes_added, 0) as notes_added, coalesce(steps_done, 0) as steps_done,
  coalesce(lists_copied, 0) as lists_copied, coalesce(marked_submitted, 0) as marked_submitted,
  coalesce(feedback_sent, 0) as feedback_sent, coalesce(failed_saves, 0) as failed_saves,
  coalesce(er.errors, 0) as errors
from ev full join er on er.day = ev.day;

-- Which tabs and My list views are opened, by day.
create view reports.pages as
select (at at time zone 'America/New_York')::date as day,
  case when name = 'tab_view' then props ->> 'tab' else 'list · ' || (props ->> 'view') end as page,
  count(*) as views, count(distinct visit) as visits
from public.events
where name in ('tab_view', 'list_view') and at > now() - interval '90 days'
group by 1, 2;

-- How far visits get, last 30 days. Signed-out visits can't be linked, so each stage counts what happened within
-- one visit; signed-in people are counted across all their visits.
create view reports.funnel as
with stages(n, stage, test) as (values
  (1, 'Opened the planner', 'app_open'),
  (2, 'Opened Find schools', 'tab:find'),
  (3, 'Opened a school', 'school_opened'),
  (4, 'Saved a school', 'school_saved'),
  (5, 'Opened My list', 'tab:list'),
  (6, 'Added a note', 'note_added'),
  (7, 'Opened Finalize & apply', 'view:apply'),
  (8, 'Copied the list for MySchools', 'list_copied'),
  (9, 'Marked submitted', 'step:s7')),
recent as (
  select coalesce(user_id::text, visit::text) as who, user_id is not null as signed_in,
    case when name = 'tab_view' then 'tab:' || (props ->> 'tab')
         when name = 'list_view' then 'view:' || (props ->> 'view')
         when name = 'step_done' then 'step:' || (props ->> 'step_id')
         else name end as test
  from public.events where at > now() - interval '30 days')
select s.n, s.stage,
  count(distinct r.who) filter (where not r.signed_in) as signed_out_visits,
  count(distinct r.who) filter (where r.signed_in) as signed_in_people
from stages s left join recent r on r.test = s.test
group by s.n, s.stage;

-- Steps checked off, last 30 days.
create view reports.steps as
select props ->> 'step_id' as step_id,
  count(*) filter (where user_id is null) as signed_out_visits,
  count(distinct user_id) as signed_in_people
from public.events
where name = 'step_done' and at > now() - interval '30 days'
group by 1;

-- Schools opened and saved, last 30 days.
create view reports.schools as
select props ->> 'dbn' as dbn,
  count(*) filter (where name = 'school_opened') as opened,
  count(*) filter (where name = 'school_saved') as saved,
  count(*) filter (where name = 'school_removed') as removed
from public.events
where name in ('school_opened', 'school_saved', 'school_removed') and at > now() - interval '30 days'
group by 1;

-- What went wrong, last 7 days: errors nobody caught, and failed saves.
create view reports.failures as
select 'error' as kind, message as what,
  case when user_agent ~ 'iPhone|iPad' then 'iPhone/iPad' when user_agent ~ 'Android' then 'Android'
       when user_agent ~ 'Edg/' then 'Edge' when user_agent ~ 'Chrome/' then 'Chrome'
       when user_agent ~ 'Safari/' then 'Safari' when user_agent ~ 'Firefox/' then 'Firefox' else 'other' end as browser,
  count(*) as times, count(distinct user_id) as signed_in_people, min(at) as first_seen, max(at) as last_seen,
  (array_agg(context order by at desc))[1] as latest_where
from public.client_errors where at > now() - interval '7 days'
group by 2, 3
union all
select 'failed save', props ->> 'error_code', null, count(*), count(distinct user_id), min(at), max(at), null
from public.events where name = 'sync_failed' and at > now() - interval '7 days'
group by 2;

-- The headline: this week against last week.
create view reports.summary as
with d as (select * from reports.daily),
wk as (
  select (day > (now() at time zone 'America/New_York')::date - 7) as this_week, *
  from d where day > (now() at time zone 'America/New_York')::date - 14)
select m.n, m.metric,
  sum(m.v) filter (where wk.this_week) as last_7_days,
  sum(m.v) filter (where not wk.this_week) as previous_7_days
from wk cross join lateral (values
  (1, 'Visits', wk.visits), (2, 'Signed-in visits', wk.signed_in_visits), (3, 'Sign-ins', wk.sign_ins),
  (4, 'Schools opened', wk.schools_opened), (5, 'Schools saved', wk.schools_saved),
  (6, 'Open houses planned', wk.open_houses_planned), (7, 'Open houses visited', wk.open_houses_visited),
  (8, 'Notes added', wk.notes_added), (9, 'Steps done', wk.steps_done), (10, 'Lists copied for MySchools', wk.lists_copied),
  (11, 'Marked submitted', wk.marked_submitted), (12, 'Feedback sent', wk.feedback_sent),
  (13, 'Failed saves', wk.failed_saves), (14, 'Errors', wk.errors)) as m(n, metric, v)
group by m.n, m.metric;

revoke all on all tables in schema reports from public, anon, authenticated;
