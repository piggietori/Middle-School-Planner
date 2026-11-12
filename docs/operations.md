# Operations

Running the planner day to day: what happens when, how to tell it's healthy, and what to do when something breaks.

## The year at a glance

| When | What happens | What you do |
|---|---|---|
| Every day October–December, Mondays otherwise | *Watch sources* checks the D20 pages, the city's admissions page and the test results dataset | If an issue opens, update the data it names ([data-sources.md](data-sources.md)) |
| Spring (around April) | The city publishes last year's test results; the watch opens an issue | Actions → *Refresh data* → Run workflow, then review and merge its pull request |
| April 7 | Offers come out; Next up says so | Nothing |
| August 15 | *New admissions cycle* opens the yearly checklist | Work through it: new key dates, flyer, school facts, survey, steps, `cycle`, restore drill, 2FA check |
| September–October | The D20 flyer comes out; open house season starts | Add the open houses (prompted by the watch) |
| October 1 – December 31 | Backups run daily; the busiest season | Watch for issues and error reports |
| December 11 | Application deadline; My list becomes read-only the next day | Nothing |
| Sundays and Wednesdays the rest of the year | *Backup* (in `planner-ops`) | Nothing, unless an alert says it failed |
| Every hour on the schedule (about every 3 hours in practice) | *Monitor* (in `planner-ops`) checks the site, Supabase, security, errors, saves, backups and capacity | Nothing, unless an `ALERT:` issue emails you ([monitoring](#monitoring)) |
| Every morning | The daily report: a comment on the pinned *Daily report* issue in `planner-ops` | Read it during the pilot and in season |
| February and March | The quietest stretch: GitHub may turn off scheduled workflows in the public repository after 60 days without a commit | Open Actions → *Watch sources*; if it says disabled, click **Enable workflow** |
| Every night | The database deletes errors over 90 days old and events over a year old | Nothing ([privacy.md](privacy.md#how-long-its-kept)) |

## Is it healthy?

| Check | How | How often |
|---|---|---|
| Everything the monitor checks | An `ALERT: <check>` issue opens in `planner-ops` and emails you. It says what to do, and closes itself when the check passes ([monitoring](#monitoring)) | Every hour, automatically |
| Use, and problems that build slowly | The daily report | Every morning in season |
| What families tell you | Feedback emails ([feedback](#feedback)) | As they arrive. During the pilot, answer within a day |
| Workflows are passing | GitHub emails you when a scheduled run fails; or look at the Actions tab | When an email arrives |
| Errors families hit | Supabase → SQL Editor: `select at, message, context from client_errors order by at desc limit 20;` | When an alert or the report points to them |
| What's being used, and where families get stuck | The usage reports ([below](#usage-reports)) | Weekly in season |
| Database is locked down | `node scripts/check-supabase.js` → "All checks passed" (the monitor also runs it hourly) | After every database change |
| Supabase project | Emails from Supabase (pausing, usage limits); keep supabase.com out of spam | When an email arrives |
| Scheduled workflows still on | Actions → *Watch sources*: no "disabled" banner | February and March |

## Monitoring

*Monitor* (`planner-ops`: `.github/workflows/monitor.yml` and `scripts/monitor.js`) runs at 17 minutes past every
hour, and checks the live site in real browsers every 3 hours. Each check guards against rows in
[failure-modes.md](failure-modes.md), the register of what can go wrong. Each check that fails opens an `ALERT: <check>` issue, comments on it each hour while it keeps failing, and
closes it when it passes. GitHub emails you about each, as long as you watch `planner-ops` (Watch → All activity).

| Check | Fails when |
|---|---|
| Site up | The live page doesn't load, or doesn't say "Middle School Planner" |
| Data loads | `data/events.json` doesn't load |
| HTTPS certificate | Fewer than 14 days left, or it can't be checked |
| App works for visitors | Every 3 hours: the site in Chromium and in Safari's engine (iPhone), signed out, doesn't load, logs an error, or can't show Dates or open a school (`scripts/smoke-live.js`) |
| Supabase up | Supabase's sign-in service doesn't answer (paused or down) |
| Security unchanged | `scripts/check-supabase.js` fails: something opened to signed-out visitors |
| Database reachable | The monitor can't query the database (password reset, or paused) |
| Errors from families | 10 or more errors in an hour, or the same error for 3 or more people |
| Saves failing | 3 or more failed saves in an hour |
| Retention job | `prune-logs` hasn't succeeded in 36 hours |
| Feedback flood | 20 or more feedback messages in an hour (only 20 an hour are emailed) |
| Feedback not emailed | A message from the last day still wasn't emailed an hour later |
| Emails and clock calls | A request the database sent (a feedback email to Resend, a clock call to GitHub) was refused or failed in the last 6 hours |
| Capacity | The database is over 400 MB (the free limit is 500) |
| Backups | No successful backup in 30 hours (October to December) or 5 days (otherwise) |

The monitor reads counts only, never emails or notes. Its database password is `planner-ops`'s `SUPABASE_DB_URL`.
After each run it pings healthchecks.io (`HEALTHCHECK_URL`), which emails you if the pings stop: that's how
you'd hear that the monitor itself stopped.

**"Every hour" is the schedule, not a promise.** GitHub starts scheduled workflows late and sometimes skips them: in
practice a run, and its ping, arrives about every 3 hours, and a gap of 7½ hours has happened (F-55 in
[failure-modes.md](failure-modes.md)). So the healthchecks.io check has period 1 hour and **grace 4 hours**: with a
shorter grace it emailed "down" several times a day while the monitor was fine. If it still emails during a long gap,
look at `planner-ops` → Actions: recent successful runs mean GitHub was slow, not that the monitor broke. Alerts from
the monitor are late by the same amount.

**The clock.** Because of that, the database starts the jobs itself (`supabase/migrations/20261113130000_clock.sql`,
using pg_cron): *Monitor* at 47 minutes past every hour, with the real-browser check every third hour; *Backup* at
08:20 UTC and *Watch sources* at 11:20 UTC, on the same days as their own schedules. GitHub's schedules still run as
the fallback, so some jobs run twice: that's harmless. The clock needs a GitHub token in the Vault
([secrets.md](secrets.md#the-clocks-github-token)); without it, it does nothing. To see it working:
`select jobname, schedule from cron.job;` and `select created, status_code from net._http_response order by created desc limit 5;`
(204 means GitHub accepted the request).

To check the site in real browsers yourself: `node scripts/smoke-live.js <site address>`.

**When an alert arrives:** do what the issue says, or find the symptom in [When something breaks](#when-something-breaks).
If families will notice, post a [banner](#the-banner).

**To test the alerts:** `planner-ops` → Actions → *Monitor* → Run workflow, with **site_url** set to an address that
doesn't exist. `ALERT: Site up` opens and emails you; the next hourly run closes it.

**The daily report** posts at 13:00 UTC (8 AM in New York in winter) as a comment on the pinned *Daily report* issue:
households, people, new sign-ups, how many signed in with an emailed code (a quiet day can mean sign-in emails
aren't arriving), how many opened the planner, schools saved, visits, steps, failed saves, feedback
received, and the top errors. To post one now: Run workflow with **report** ticked.

## Usage reports

Owner-only views in the `reports` schema (`supabase/migrations/20261114120000_usage.sql`). The API doesn't serve
them: open Supabase → **SQL Editor** and run one. Save each as a snippet (the ⋯ menu → *Save*), and use the result's
**Chart** button to graph it. "Visits" are page loads, signed in or not; "people" are signed-in accounts. Days are
New York days.

| Question | Run |
|---|---|
| How's this week compared with last? | `select metric, last_7_days, previous_7_days from reports.summary order by n;` |
| Activity and engagement by day | `select * from reports.daily order by day desc;` (chart `day` against `visits`, `schools_saved`…) |
| Which tabs and views are used | `select page, sum(views) views, sum(visits) visits from reports.pages where day > current_date - 7 group by 1 order by 2 desc;` |
| How far families get (last 30 days) | `select stage, signed_out_visits, signed_in_people from reports.funnel order by n;` |
| Which steps get checked off | `select * from reports.steps order by step_id;` |
| Which schools draw interest | `select * from reports.schools order by saved desc, opened desc limit 20;` |
| What's going wrong (last 7 days) | `select * from reports.failures order by times desc;` |

**Reading them.**
- **Signed-out visits can't be linked**, by design, so their funnel counts what happened within one visit. A family
  who saves on Monday and copies the list on Thursday shows up as two partial visits. Signed-in people are followed
  across visits.
- **A big drop between two funnel stages** is where families get stuck: for example many open schools but few
  save, or many reach Finalize & apply but few copy the list.
- **Failures** groups errors by message and browser: one message on one browser (often iPhone) is usually a bug
  to fix. Failed saves by `error_code`: `network` is a family's connection; anything else is ours.
- Counts start when `20261114120000_usage.sql` is applied and this version is live. Visits from `localhost` aren't counted.

## Feedback

*Send feedback* (in the footer, and in the pilot notice) saves the message in the `feedback` table, and the database
emails it to the address in the Vault secret `feedback_to`. If the family left an address, reply to the email to
answer them.

- **During the pilot,** answer within a day.
- **A wrong date or fact:** fix it in a pull request ([data-sources.md](data-sources.md)), and post a banner if it matters.
- **A bug:** open an issue in the public repository. Describe the problem; never copy the family's email or notes into it.
- **Not emailed** (over 20 an hour, or Resend failed): the daily report counts them. Read them in the SQL Editor:
  `select at, kind, message, reply_to, page from feedback where not emailed order by at desc;`
- Messages are deleted automatically after a year. Delete the emails from your inbox when they're dealt with.

## The banner

To tell every family something (an open house moved, sign-in having problems), edit `data/notice.json` in a pull request:

```json
"notice": {"text": "The I.S. 187 open house moved to Thursday, Nov 13.", "level": "warn", "until": "2026-11-13"}
```

`level` is `info` or `warn`; `until` (the last day it shows) and `link` (`{"url": …, "label": …}`) are optional.
It's live a minute or two after merging, on every tab. Set it back to `null` when it's over; the data checks warn once
its `until` date has passed.

## Invite-only

During the pilot, Supabase → Authentication → Sign In / Providers → **Allow new users to sign up** is off. Invite a
family from Authentication → Users → **Invite user**. (The invite email's own link doesn't sign anyone in: the
planner accepts only a typed code, so tell the family to open the planner and ask for one.) Anyone else who asks for a sign-in code sees "The planner is
invite-only for now". Turn it back on to open to everyone ([launch.md](launch.md#sharing-with-parent-groups)).

## When something breaks

| Symptom | Likely cause | Fix |
|---|---|---|
| The site shows "The planner couldn't load" | A broken deploy, or a data file that didn't load | Actions → Deploy: check the last run. If a recent merge broke it, revert that pull request (GitHub → the PR → Revert) and merge the revert |
| A family is signed out and their plan looks empty | The browser's site data was cleared (a setting such as Chrome's "Delete data sites have saved to your device when you close all windows" at `chrome://settings/content/siteData`, a cleaner app, or clearing browsing data), or they're on a different address (for example `localhost` instead of the live site) | Sign in again: the account has the plan. Turn that browser setting off, or add the site under "Allowed to save data" |
| "Couldn't reach your account" for everyone | The Supabase project is paused or down | Supabase dashboard → the project → **Resume project** if paused ([backups.md](backups.md#supabase-project-pausing)); otherwise check status.supabase.com. Families keep working on their devices meanwhile |
| "Couldn't reach your account" right after a database change | A missing grant or a migration not applied | Run `node scripts/check-supabase.js`; apply the missing migration in the SQL Editor |
| The sign-in email doesn't arrive | It went to spam; Supabase's limit (60 an hour) was reached; or Resend refused it | Check spam. Resend → **Logs** shows each email and why it failed. Supabase → Authentication → Logs shows the request |
| "The planner is invite-only for now" | Sign-ups are off and that address wasn't invited | Invite it ([invite-only](#invite-only)), or check they typed the address you invited |
| Feedback doesn't arrive by email | A Vault secret is missing, the Resend key was revoked, or the hourly limit was reached | Read it in the SQL Editor ([feedback](#feedback)). Check Resend → Logs; [rotate the key](secrets.md#rotate-a-resend-key) if needed |
| "That code didn't work or has expired" | Codes work once and expire after 30 minutes; a newer email cancels older codes | Send a new email and type the newest code |
| "That sign-in link has expired" | A link that carries a sign-in: from an email sent before v1.3.0, or made by someone else. The planner never accepts one ([security.md](security.md#controls-layer-by-layer)) | Send a new email; it has a code |
| "Whose plan is on this device?" | Someone signed in on a device that still has a plan from a different account | It's working as intended: **No** keeps that plan out of their account, **Yes** adds it |
| "The planner couldn't load. This browser is too old for it." | A browser from before about 2022 | Update the phone or browser, or use another device |
| "Couldn't save. We'll try again when you're back online." | Offline, or the server refused the save | Changes are kept on the device and sent again by themselves: after 5 seconds, then up to every 5 minutes, and when back online. If it persists online, look in `client_errors` |
| The site looks unstyled or a feature stopped working after a change, with "Refused to…" in the Console | The Content-Security-Policy blocked something new | Add the new server to the policy ([security.md](security.md#content-security-policy)), or revert |
| A wrong date or fact is live | A data mistake that got through review | Fix it in a pull request (keep the event's `id`, add `was` if the time moved), or revert the pull request that caused it |
| *Backup* failed, or `ALERT: Database reachable` | The project is paused, the database password was reset, or a secret is missing | If paused, resume it. Otherwise update `SUPABASE_DB_URL` in `planner-ops` ([secrets.md](secrets.md#reset-the-database-password)), then run Backup by hand |
| *Watch sources* opened an issue saying a page couldn't be checked | The page moved or was down | Open the page; if its address changed, update `watch` in `data/schools.json` |
| A family deleted their plan by mistake | — | Restore their plan from a backup ([backups.md](backups.md#restoring)) |
| Locked out of GitHub or Supabase | Lost password or 2FA device | Use the account's recovery codes or email recovery. Keep recovery codes in the password manager |

## Making changes

- **Code or data:** create a branch, open a pull request into `main`, and let CI pass. The `main` ruleset won't
  allow merging until it does. Merging deploys within a minute or two.
- **Pull requests opened by *Refresh data*:** CI doesn't start by itself on pull requests a workflow opens, so the
  ruleset would block merging. Click **Close pull request**, then **Reopen**: your reopening starts CI.
- **Database:** add a file in `supabase/migrations/`, with tests in `tests/db/rls.test.js`. After merging, paste
  it into the Supabase SQL Editor and run `node scripts/check-supabase.js`. Never edit a migration that has
  already been applied ([supabase/README.md](../supabase/README.md)).
- **A release** ([CHANGELOG.md](../CHANGELOG.md)):
  1. As you go, add each change under `## [Unreleased]` in CHANGELOG.md, in words a family would understand.
  2. In the pull request that releases: rename `## [Unreleased]` to `## [X.Y.Z] - date`, add a new empty
     `## [Unreleased]` above it, update the links at the bottom, and set `version` in `package.json`. CI fails if the
     version has no notes.
  3. Merge, then `git tag -a vX.Y.Z -m vX.Y.Z && git push origin vX.Y.Z`. The *Release* workflow
     (`.github/workflows/release.yml`) publishes the GitHub Release with that version's notes.

## Free-plan limits that matter

| Service | Limit | Effect here |
|---|---|---|
| Supabase | Pauses after about a week without database activity | The hourly monitor keeps it active ([backups.md](backups.md#supabase-project-pausing)) |
| GitHub Actions | Scheduled workflows turn off after 60 days without a commit (public repos) | Only *Watch sources* is affected. Check in February and March (calendar above) |
| Resend | 100 emails a day, 3,000 a month | Each sign-in is one email, so 100 sign-ins a day. The day the link goes to a large parent group can pass that: share with one group at a time, or take the paid plan for that month |
| Supabase | 60 sign-in emails an hour (our setting since 2026-11-12; 30 before) | Raise it further (for example to 100) in Authentication → Rate Limits before sharing with a group, and lower it again afterwards: past it, families see "Too many sign-in emails were sent" |
| Supabase | 500 MB database, no backups of its own | Thousands of households would still fit; we make our own backups |
| GitHub Actions | Free for public repositories; 2,000 minutes a month for private ones | The monitor and backups in `planner-ops` use about 800 |
| GitHub Pages | Public site, 1 GB, about 100 GB of traffic a month | Far more than needed |
