# Operations

Running the planner day to day: what happens when, how to tell it's healthy, and what to do when something breaks.

## The year at a glance

| When | What happens | What you do |
|---|---|---|
| Every Monday | *Watch sources* checks the D20 pages, the city's admissions page and the test results dataset | If an issue opens, update the data it names ([data-sources.md](data-sources.md)) |
| Spring (around April) | The city publishes last year's test results; the watch opens an issue | Actions → *Refresh data* → Run workflow, then review and merge its pull request |
| April 7 | Offers come out; Next up says so | Nothing |
| August 15 | *New admissions cycle* opens the yearly checklist | Work through it: new key dates, flyer, school facts, survey, steps, `cycle`, restore drill, 2FA check |
| September–October | The D20 flyer comes out; open house season starts | Add the open houses (prompted by the watch) |
| October 1 – December 31 | Backups run daily; the busiest season | Watch for issues and error reports |
| December 11 | Application deadline; My list becomes read-only the next day | Nothing |
| Every Sunday the rest of the year | Weekly backup | Nothing, unless GitHub emails you that it failed |

## Is it healthy?

| Check | How | How often |
|---|---|---|
| Site is up | Open https://piggietori.github.io/Middle-School-Planner/ | When you use it |
| Workflows are passing | GitHub emails you when a scheduled run fails; or look at the Actions tab | When an email arrives |
| Errors families hit | Supabase → SQL Editor: `select at, message, context from client_errors order by at desc limit 20;` | Weekly in season |
| What's being used | `select name, count(*) from events where at > now() - interval '7 days' group by name order by 2 desc;` | When curious |
| Database is locked down | `node scripts/check-supabase.js` → "All checks passed" | After every database change |
| Supabase project | Emails from Supabase (pausing, usage limits) | When an email arrives |

## When something breaks

| Symptom | Likely cause | Fix |
|---|---|---|
| The site shows "The planner couldn't load" | A broken deploy, or a data file that didn't load | Actions → Deploy: check the last run. If a recent merge broke it, revert that pull request (GitHub → the PR → Revert) and merge the revert |
| "Couldn't reach your account" for everyone | The Supabase project is paused or down | Supabase dashboard → the project → Restore if paused; otherwise check status.supabase.com. Families keep working on their devices meanwhile |
| "Couldn't reach your account" right after a database change | A missing grant or a migration not applied | Run `node scripts/check-supabase.js`; apply the missing migration in the SQL Editor |
| The sign-in email doesn't arrive | Supabase's built-in sender allows about 2 emails an hour, or it went to spam | Wait an hour and send once; check spam. For more families, set up custom SMTP |
| "That sign-in link has expired or was already used" | Links work once and expire in an hour; a newer link cancels older ones | Send a new link and use the newest email |
| "Couldn't save. We'll try again when you're back online." | Offline, or the server refused the save | Changes are kept on the device and sent when back online. If it persists online, look in `client_errors` |
| A wrong date or fact is live | A data mistake that got through review | Fix it in a pull request (keep the event's `id`, add `was` if the time moved), or revert the pull request that caused it |
| *Backup* failed | The database password was reset, or a secret is missing | Update `SUPABASE_DB_URL` ([secrets.md](secrets.md#reset-the-database-password)), then run Backup by hand |
| *Watch sources* opened an issue saying a page couldn't be checked | The page moved or was down | Open the page; if its address changed, update `watch` in `data/schools.json` |
| A family deleted their plan by mistake | — | Restore their plan from a backup ([backups.md](backups.md#restoring)) |
| Locked out of GitHub or Supabase | Lost password or 2FA device | Use the account's recovery codes or email recovery. Keep recovery codes in the password manager |

## Making changes

- **Code or data:** create a branch, open a pull request into `main`, and let CI pass. Merging deploys within a minute or two.
- **Database:** add a file in `supabase/migrations/`, with tests in `tests/db/rls.test.js`. After merging, paste
  it into the Supabase SQL Editor and run `node scripts/check-supabase.js`. Never edit a migration that has
  already been applied ([supabase/README.md](../supabase/README.md)).
- **A release:** set `version` in `package.json`, merge to `main`, then tag (`git tag -a vX.Y.Z`) and publish a
  GitHub Release with notes.

## Free-plan limits that matter

| Service | Limit | Effect here |
|---|---|---|
| Supabase | Pauses after about a week without database activity | Backups keep it active; watch for the warning email ([backups.md](backups.md#supabase-project-pausing)) |
| Supabase | About 2 sign-in emails an hour (built-in sender) | Fine for one household; custom SMTP before opening up |
| Supabase | 500 MB database, no backups of its own | Thousands of households would still fit; we make our own backups |
| GitHub Actions | Free for public repositories | No cost for CI, watch, refresh or backups |
| GitHub Pages | Public site, 1 GB, about 100 GB of traffic a month | Far more than needed |
