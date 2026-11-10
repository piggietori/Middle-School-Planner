-- How long usage events and error reports are kept (docs/privacy.md): errors 90 days, events 1 year.
-- prune_logs() deletes older rows. Only the database owner can run it, and pg_cron runs it every night.
-- Backups made before a row was deleted still hold it until they expire (docs/backups.md).

create function public.prune_logs() returns jsonb
language plpgsql set search_path = '' as $$
declare errs bigint; evs bigint;
begin
  delete from public.client_errors where at < now() - interval '90 days';
  get diagnostics errs = row_count;
  delete from public.events where at < now() - interval '1 year';
  get diagnostics evs = row_count;
  return jsonb_build_object('errors', errs, 'events', evs);
end $$;

revoke execute on function public.prune_logs() from public, anon, authenticated;

-- Every night at 3:30 UTC (late evening in New York). pg_cron comes with Supabase, including the free plan;
-- where it isn't available (the PGlite tests), the schedule is skipped. cron.schedule replaces a job of the
-- same name, so running this again is safe. See the job: select * from cron.job;
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('prune-logs', '30 3 * * *', 'select public.prune_logs()');
  end if;
end $$;
