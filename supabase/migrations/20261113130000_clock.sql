-- A dependable clock for the scheduled jobs (F-55 in docs/failure-modes.md). GitHub starts scheduled workflows late
-- and skips some: on 2026-11-12 the hourly Monitor ran 4 times in 14 hours, and the daily Backup and Watch sources
-- didn't run at all. The database already has a scheduler (pg_cron) and can make web requests (pg_net), so it asks
-- GitHub to run each workflow at the right time. GitHub's own schedules stay as the fallback.
--
-- It needs one Vault secret, set by the owner in the SQL Editor and never in a file (docs/secrets.md):
--   select vault.create_secret('<the token>', 'github_actions_token');
-- a fine-grained GitHub token for these two repositories only, with "Actions: Read and write" and nothing else.
-- Until it's set, run_workflow() does nothing.

create function public.run_workflow(repo text, workflow text, inputs jsonb default '{}') returns void
language plpgsql security definer set search_path = '' as $$
declare t text;
begin
  if repo not in ('Middle-School-Planner', 'planner-ops') then raise exception 'unknown repository %', repo; end if;
  select decrypted_secret into t from vault.decrypted_secrets where name = 'github_actions_token';
  if t is null then return; end if;
  perform net.http_post(
    url := 'https://api.github.com/repos/piggietori/' || repo || '/actions/workflows/' || workflow || '/dispatches',
    headers := jsonb_build_object('Authorization', 'Bearer ' || t, 'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28', 'User-Agent', 'd20-planner-clock', 'Content-Type', 'application/json'),
    body := jsonb_build_object('ref', 'main', 'inputs', inputs));
exception when others then
  raise warning 'clock: % in % not started: %', workflow, repo, sqlerrm; -- the fallback schedule still runs it
end $$;
-- Only the database owner (pg_cron runs as it): nobody can start workflows through the API.
revoke execute on function public.run_workflow(text, text, jsonb) from public, anon, authenticated;

-- The times, in UTC. Monitor runs at :47, half an hour from GitHub's own :17, and every third hour also checks the
-- site in real browsers. Backup and Watch sources follow the same calendar as their workflows: daily in October to
-- December, less often otherwise. cron.schedule replaces a job of the same name, so running this again is safe.
-- See them: select jobname, schedule from cron.job;  and their runs: select * from cron.job_run_details order by start_time desc limit 10;
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('clock-monitor', '47 * * * *',
      $job$select public.run_workflow('planner-ops', 'monitor.yml', jsonb_build_object('clock', 'true', 'with_browser', (extract(hour from now() at time zone 'UTC')::int % 3 = 0)::text))$job$);
    perform cron.schedule('clock-backup-season', '20 8 * 10-12 *', $job$select public.run_workflow('planner-ops', 'backup.yml')$job$);
    perform cron.schedule('clock-backup', '20 8 * 1-9 0,3', $job$select public.run_workflow('planner-ops', 'backup.yml')$job$);
    perform cron.schedule('clock-watch-season', '20 11 * 10-12 *', $job$select public.run_workflow('Middle-School-Planner', 'watch-sources.yml')$job$);
    perform cron.schedule('clock-watch', '20 11 * 1-9 1', $job$select public.run_workflow('Middle-School-Planner', 'watch-sources.yml')$job$);
  end if;
end $$;
