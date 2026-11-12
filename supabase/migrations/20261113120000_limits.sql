-- Limits, so one person or one script can't fill the database (500 MB on the free plan) and stop everyone's
-- saves (F-22 in docs/failure-modes.md). The planner itself stays far inside all of them.
-- The new checks are "not valid": they apply to every new or changed row, without failing on rows already there.

-- Notes: each line at most 200 characters, like the box in the planner. (There were already at most 50 lines.)
create function public.all_short(lines text[], max_len int) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(bool_and(length(l) <= max_len), true) from unnest(lines) as l
$$;
alter table public.school_notes
  add constraint school_notes_line_length check (public.all_short(pros, 200) and public.all_short(cons, 200)) not valid;

-- Weights: a small object (the planner sends five numbers).
alter table public.plans
  add constraint plans_weights_small check (jsonb_typeof(weights) = 'object' and pg_column_size(weights) <= 400) not valid;

-- Feedback: at most 200 messages an hour from everyone together. (Only 20 an hour are emailed; the monitor's
-- "Feedback flood" alert fires at 20.) Past the limit the form says it couldn't send, and the message stays in the box.
create index feedback_at on public.feedback (at);
create function public.limit_feedback() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.feedback where at > now() - interval '1 hour') >= 200 then
    raise exception 'Too much feedback right now. Try again later.' using errcode = '54000';
  end if;
  return new;
end $$;
revoke execute on function public.limit_feedback() from public, anon, authenticated;
create trigger limit_feedback before insert on public.feedback for each row execute function public.limit_feedback();

-- Usage events and error reports: at most 1,000 events and 100 errors an hour from one person. The planner sends
-- a handful per visit, and drops what the database refuses.
create index events_user_at on public.events (user_id, at);
create index client_errors_user_at on public.client_errors (user_id, at);
create function public.limit_logs() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where user_id = $1 and at > now() - interval ''1 hour''', tg_table_name)
    into n using new.user_id;
  if n >= tg_argv[0]::bigint then
    raise exception 'Too many % rows this hour', tg_table_name using errcode = '54000';
  end if;
  return new;
end $$;
revoke execute on function public.limit_logs() from public, anon, authenticated;
create trigger limit_events before insert on public.events for each row execute function public.limit_logs('1000');
create trigger limit_client_errors before insert on public.client_errors for each row execute function public.limit_logs('100');

-- The note check runs as the person saving the note.
grant execute on function public.all_short(text[], int) to authenticated;
