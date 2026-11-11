-- The feedback email in the words the family saw: the kind as the form's label ("Something isn't working", not
-- "problem"), where they were as the tab's name and the open school, and the time in New York.
-- feedback_email() writes the subject and text, so the database tests can check them without Vault or pg_net.

create function public.feedback_email(f public.feedback) returns jsonb
language sql stable set search_path = '' as $$
  with p as (
    select case f.kind
             when 'problem' then 'Something isn''t working'
             when 'wrong_info' then 'A date or school detail is wrong'
             when 'idea' then 'An idea'
             else 'Something else' end as kind,
           -- page is "<tab>" or "<tab> · <school>", as src/feedback.js sends it
           case split_part(coalesce(f.page, ''), ' · ', 1)
             when 'home' then 'Home'
             when 'dates' then 'Dates'
             when 'find' then 'Find schools'
             when 'list' then 'My list'
             when '' then null
             else split_part(f.page, ' · ', 1) end as tab,
           nullif(split_part(coalesce(f.page, ''), ' · ', 2), '') as school
  )
  select jsonb_build_object(
    'subject', 'Planner feedback: ' || p.kind || ' (#' || f.id || ')',
    'text', f.message || E'\n\n—\nAbout: ' || p.kind
      || E'\nWhere: ' || case when p.tab is null then 'not recorded'
                              else p.tab || ' tab' || coalesce(', with school ' || p.school || ' open', '') end
      || E'\nReply to: ' || coalesce(f.reply_to, 'not given (anonymous)')
      || E'\nSent: ' || to_char(f.at at time zone 'America/New_York', 'Dy Mon FMDD, YYYY, FMHH12:MI AM') || ' (New York)')
  from p
$$;
revoke execute on function public.feedback_email(public.feedback) from public, anon, authenticated;

create or replace function public.email_feedback() returns trigger
language plpgsql security definer set search_path = '' as $$
declare k text; t text; f text; e jsonb;
begin
  if (select count(*) from public.feedback where emailed and at > now() - interval '1 hour') >= 20 then return new; end if;
  select max(decrypted_secret) filter (where name = 'resend_api_key'), max(decrypted_secret) filter (where name = 'feedback_to'),
         max(decrypted_secret) filter (where name = 'feedback_from')
    into k, t, f from vault.decrypted_secrets where name in ('resend_api_key', 'feedback_to', 'feedback_from');
  if k is null or t is null or f is null then return new; end if;
  e := public.feedback_email(new);
  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || k, 'Content-Type', 'application/json'),
    body := jsonb_strip_nulls(jsonb_build_object(
      'from', f, 'to', jsonb_build_array(t), 'reply_to', new.reply_to, 'subject', e->>'subject', 'text', e->>'text')));
  update public.feedback set emailed = true where id = new.id;
  return new;
exception when others then
  raise warning 'feedback % not emailed: %', new.id, sqlerrm;
  return new;
end $$;
