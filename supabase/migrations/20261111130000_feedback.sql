-- Feedback from families (the "Send feedback" form), emailed to the owner as it arrives (docs/operations.md).
-- Anyone can send it, signed in or not, and it isn't linked to an account: only what they write, which kind,
-- where in the planner, and a reply address if they choose to give one. Nobody can read it through the API.

create table public.feedback (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('problem', 'wrong_info', 'idea', 'other')),
  message text not null check (length(message) between 1 and 2000),
  reply_to text check (reply_to is null or (length(reply_to) <= 254 and reply_to ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  page text check (length(page) <= 100), -- where in the planner, for example "find · 20K187"
  emailed boolean not null default false,
  at timestamptz not null default now()
);

alter table public.feedback enable row level security;
create policy "anyone can send feedback" on public.feedback for insert to anon, authenticated with check (not emailed);
revoke all on public.feedback from anon, authenticated;
grant insert (kind, message, reply_to, page) on public.feedback to anon, authenticated;

-- Email each message to the owner through Resend. The API key, the owner's address and the sender are kept in
-- Supabase Vault (set them in the SQL Editor; see docs/operations.md), never in this repository.
-- At most 20 emails an hour, so a flood can't run through the email allowance; the rest are kept, and the
-- monitor reports them. If anything here fails, the feedback is still saved.
create function public.email_feedback() returns trigger
language plpgsql security definer set search_path = '' as $$
declare k text; t text; f text;
begin
  if (select count(*) from public.feedback where emailed and at > now() - interval '1 hour') >= 20 then return new; end if;
  select max(decrypted_secret) filter (where name = 'resend_api_key'), max(decrypted_secret) filter (where name = 'feedback_to'),
         max(decrypted_secret) filter (where name = 'feedback_from')
    into k, t, f from vault.decrypted_secrets where name in ('resend_api_key', 'feedback_to', 'feedback_from');
  if k is null or t is null or f is null then return new; end if;
  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || k, 'Content-Type', 'application/json'),
    body := jsonb_strip_nulls(jsonb_build_object(
      'from', f, 'to', jsonb_build_array(t), 'reply_to', new.reply_to,
      'subject', 'Planner feedback: ' || replace(new.kind, '_', ' ') || ' (#' || new.id || ')',
      'text', new.message || E'\n\n—\nKind: ' || new.kind || E'\nWhere: ' || coalesce(new.page, 'unknown')
        || E'\nReply to: ' || coalesce(new.reply_to, 'not given (anonymous)') || E'\nSent: ' || new.at)));
  update public.feedback set emailed = true where id = new.id;
  return new;
exception when others then
  raise warning 'feedback % not emailed: %', new.id, sqlerrm;
  return new;
end $$;
revoke execute on function public.email_feedback() from public, anon, authenticated;
create trigger email_feedback after insert on public.feedback for each row execute function public.email_feedback();

-- pg_net sends the emails (available on Supabase, including the free plan; skipped where it isn't, as in the tests).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
end $$;

-- Feedback is kept a year, like usage events.
create or replace function public.prune_logs() returns jsonb
language plpgsql set search_path = '' as $$
declare errs bigint; evs bigint; fb bigint;
begin
  delete from public.client_errors where at < now() - interval '90 days';
  get diagnostics errs = row_count;
  delete from public.events where at < now() - interval '1 year';
  get diagnostics evs = row_count;
  delete from public.feedback where at < now() - interval '1 year';
  get diagnostics fb = row_count;
  return jsonb_build_object('errors', errs, 'events', evs, 'feedback', fb);
end $$;
revoke execute on function public.prune_logs() from public, anon, authenticated;
