# Privacy

What personal data the planner keeps, why, who can see it, and how long it's kept. Families read the short version,
[privacy.html](../privacy.html) (linked from every page and the sign-in sheet). Keep the two in step: a change here
is a change there, with its "Last updated" date.

## What we keep

| Data | Where | Why | Who can see it | Kept until |
|---|---|---|---|---|
| Email address | Supabase sign-in; backups (`users.csv`); the device, while signed in or after an unexpected sign-out (`d20plan-email`) | To send sign-in codes, and to fill it in when signing in again | The person; the project owner | The account is deleted (backups: 90 days more). On the device: until they sign out or choose "Not you? Forget this email" |
| The plan: home neighborhood, priorities, saved schools, visits, steps | The device; the account if signed in; backups | It's the planner | The household; the project owner | Deleted by the family (device: sign out and remove, or clear the browser) |
| Notes about schools (rating, likes, concerns) | Same as the plan | Comparing schools | Same as the plan | Same as the plan |
| Where they left off (tab, open school) | The device; the account if signed in | Resume on any device | The person; the project owner | The account is deleted |
| Usage events ([the list](journeys.md#events-we-log-v2)): tabs opened, schools opened, saved or removed, open houses planned or visited, a note added (never its text), steps done, preferences changed (not their values), list copied, feedback sent, save failed. IDs only | Supabase `events`, from every visit on the live site. Signed out: no user, and a `visit` ID made fresh on each page load and never stored, so visits can't be linked | Knowing which features are used and where people get stuck | The project owner only | 1 year, then deleted automatically (backups keep copies 90 days more). Unlinked from the person if they delete their account |
| Errors: message, where in the app, browser type | Supabase `client_errors` (signed in or not; signed out, with no user) | Fixing problems | The project owner only | 90 days, then deleted automatically (backups: 90 days more). Unlinked on account deletion |
| Feedback: what it's about, the message, a reply address if they give one, and which tab or school they were on | Supabase `feedback` (anyone, signed in or not; never linked to an account); emailed to the owner | Answering problems and fixing wrong dates | The project owner; Resend while sending it | 1 year, then deleted automatically (backups: 90 days more). The email stays in the owner's inbox until deleted |

**What we don't keep:**
- passwords (sign-in is by emailed code)
- the child's name, age or school
- the family's exact address (only a neighborhood)
- location
- payment details

We also don't record anything about visitors who aren't signed in, unless they send feedback.

## Who can see it

- **The family**, in the app, on any device where they sign in.
- **Their household.** Today each person has their own household. When sharing arrives, the members of a shared
  household will see the same plan.
- **The project owner** (you), through the Supabase dashboard, which can read every table. Be honest about this in
  the privacy policy, and don't browse families' notes.
- **Our hosts:** Supabase stores the database, in the region named in `SUPABASE_REGION` (`src/config.js`, shown in
  the notice). Resend sends the sign-in and feedback emails, so it sees email addresses and feedback messages. GitHub
  hosts the site and keeps the encrypted backups in the private `planner-ops` repository. Each handles data under its
  own terms.

## What a visitor's browser contacts

| Service | When | What it learns |
|---|---|---|
| GitHub Pages | Every visit | IP address and browser, like any website |
| Supabase | Every visit to the live site (usage counts); signed in; or when sending feedback | Usage counts and errors; the account and plan, as above; or the feedback, without the account |
| Google Calendar, MySchools, school websites, InsideSchools, Google Maps | Only when the family clicks a link | Whatever that site normally collects |

The fonts are served from the site itself, so visiting doesn't contact Google. The planner has no ads, cookies, third-party analytics
scripts or trackers (its own usage counts go to its own database, above), and its [Content-Security-Policy](security.md#content-security-policy) stops the page contacting
any other server.

## Children

The planner is for parents planning a child's middle school application. It never asks for the child's name or
details. Notes are free text, so the privacy policy should ask families not to put identifying details about their
child in them. The planner isn't meant to be used by children themselves.

## A family's choices

- **Use it without an account.** Everything stays on their device.
- **A copy of their data:** they email `help@` from the account's address; the owner exports what the account holds (Supabase SQL Editor) and sends it. There's no download button: a data file meant nothing to families.
- **Delete my account** (Account): removes their account and plan, and optionally the copy on the device. Their
  past usage events and errors stay, without anything linking them to the person.
- **Sign out and remove:** takes the plan off a shared computer.

## How long it's kept

Every night at 3:30 UTC, a scheduled job in the database (`prune-logs`, using pg_cron) runs `public.prune_logs()`,
which deletes errors older than 90 days, and events and feedback older than a year
(`supabase/migrations/20261111120000_retention.sql`). To check it ran, in the SQL Editor:

```sql
select jobname, schedule, active from cron.job;
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
```

To change the periods, add a new migration that replaces the function (`create or replace function public.prune_logs()…`).

## Decided before opening to other families (November 2026)

| Decision | What we did |
|---|---|
| Backups holding other families' data | Moved to the private `planner-ops` repository ([backups.md](backups.md)) |
| A privacy notice and terms | [privacy.html](../privacy.html), linked from the footer and the sign-in sheet ("By signing in you agree to…") |
| Where the data is stored | The project's existing region, stated in the notice. Moving it wasn't worth a new project |
| Requests from families | Deleting is self-serve. A copy of their data, and anything else, by email to `help@`: reply within a few days, act within 30 |
| If data may have been seen | Email the families affected within 72 hours: what happened and what to do |
