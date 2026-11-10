# Privacy

What personal data the planner keeps, why, who can see it, and how long it's kept. This is the raw material for
a privacy policy, which the planner needs before it's opened to families outside our household.

## What we keep

| Data | Where | Why | Who can see it | Kept until |
|---|---|---|---|---|
| Email address | Supabase sign-in; backups (`users.csv`) | To send sign-in links | The person; the project owner | The account is deleted (backups: 90 days more) |
| The plan: home neighborhood, priorities, saved schools, visits, steps | The device; the account if signed in; backups | It's the planner | The household; the project owner | Deleted by the family (device: sign out and remove, or clear the browser) |
| Notes about schools (rating, likes, concerns) | Same as the plan | Comparing schools | Same as the plan | Same as the plan |
| Where they left off (tab, open school) | The device; the account if signed in | Resume on any device | The person; the project owner | The account is deleted |
| Usage events: app opened, signed in, school saved or removed, visit marked, step done, save failed. IDs only | Supabase `events` (signed in only) | Knowing which features are used and where people get stuck | The project owner only | 1 year, then deleted automatically (backups keep copies 90 days more). Unlinked from the person if they delete their account |
| Errors: message, where in the app, browser type | Supabase `client_errors` (signed in only) | Fixing problems | The project owner only | 90 days, then deleted automatically (backups: 90 days more). Unlinked on account deletion |

**What we don't keep:**
- passwords (sign-in is by emailed link)
- the child's name, age or school
- the family's exact address (only a neighborhood)
- location
- payment details

We also don't record anything about visitors who aren't signed in.

## Who can see it

- **The family**, in the app, on any device where they sign in.
- **Their household.** Today each person has their own household. When sharing arrives, the members of a shared
  household will see the same plan.
- **The project owner** (you), through the Supabase dashboard, which can read every table. Be honest about this in
  the privacy policy, and don't browse families' notes.
- **Our hosts:** Supabase stores the database, and GitHub hosts the site and the encrypted backups. Both handle data
  under their own terms.

## What a visitor's browser contacts

| Service | When | What it learns |
|---|---|---|
| GitHub Pages | Every visit | IP address and browser, like any website |
| Supabase | Signed in only | The account and plan, as above |
| Google Calendar, MySchools, school websites, InsideSchools, Google Maps | Only when the family clicks a link | Whatever that site normally collects |

The fonts are served from the site itself, so visiting doesn't contact Google. The planner has no ads, analytics
scripts or trackers, and its [Content-Security-Policy](security.md#content-security-policy) stops the page contacting
any other server.

## Children

The planner is for parents planning a child's middle school application. It never asks for the child's name or
details. Notes are free text, so the privacy policy should ask families not to put identifying details about their
child in them. The planner isn't meant to be used by children themselves.

## A family's choices

- **Use it without an account.** Everything stays on their device.
- **Download my data** (Account): a file of everything their account holds.
- **Delete my account** (Account): removes their account and plan, and optionally the copy on the device. Their
  past usage events and errors stay, without anything linking them to the person.
- **Sign out and remove:** takes the plan off a shared computer.

## How long it's kept

Every night at 3:30 UTC, a scheduled job in the database (`prune-logs`, using pg_cron) runs `public.prune_logs()`,
which deletes errors older than 90 days and events older than a year
(`supabase/migrations/20261111120000_retention.sql`). To check it ran, in the SQL Editor:

```sql
select jobname, schedule, active from cron.job;
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
```

To change the periods, add a new migration that replaces the function (`create or replace function public.prune_logs()…`).

## To decide before opening to other families

| Decision | Recommendation |
|---|---|
| Backups holding other families' data | Move backups off GitHub ([backups.md](backups.md#when-to-revisit)) |
| A privacy policy and terms | Write them from this page, and link them in the app's footer and the sign-in sheet |
| Where the data is stored | Choose the Supabase region knowingly (the project's region is shown in the dashboard), and say it in the policy |
