# Backups

How a family's plan is protected against loss, and how to get it back.
School and open house data isn't covered here: it lives in git, and its history is its backup.

## Four copies of a family's plan

| Copy | Where | Up to date | Protects against |
|---|---|---|---|
| 1. The device | The browser on every device the family uses (`localStorage`) | Instantly | The server being down or unreachable; working offline |
| 2. The account | Supabase database (encrypted at rest) | Within a second | A lost or wiped phone or laptop, a new device |
| 3. The backup | Encrypted file in the private `planner-ops` repository's Actions, kept 90 days | Daily Oct–Dec, twice a week otherwise | A mistake or bug that changes the account and then syncs to every device; a deleted account; a lost Supabase project |
| 4. The family's own download | Wherever they save it (Account → Download my data) | When they download it | Anything, as long as they keep it |

A family that never signs in has only copy 1. Clearing their browser data or losing the device loses their plan.
The Home screen suggests signing in ("Keep your plan safe") as soon as they've saved a school.

## The backup

| | |
|---|---|
| Workflow | `.github/workflows/backup.yml` in the private `planner-ops` repository (*Backup* in its Actions). Private, so only you can download the files |
| When | Every day in October to December, Sundays and Wednesdays the rest of the year, at about 4 AM New York time; or by hand |
| What | `users.csv` (account ID, email, created date) and `public-data.sql` (every household, plan, saved school, visit, step, note, session, event and error) |
| Not included | Source data (in git), passwords (there are none: sign-in is by emailed code), plans that exist only on a device |
| Encryption | gpg, AES-256, with the passphrase in the `BACKUP_PASSPHRASE` secret, before the file leaves GitHub's runner |
| Kept | 90 days as a workflow artifact, then deleted by GitHub automatically |
| Size | About 2 KB per household |
| Needs | `planner-ops` secrets `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE` ([secrets.md](secrets.md)) |

**Why this schedule:** at most a day of changes can be lost during application season, when families change their
plans almost every day before the December 11 deadline. Outside the season, at most four days, which is a few minutes
of re-entering.

**Why not Supabase's own backups:** the free plan doesn't have any. The Pro plan ($25/month) adds daily backups
kept 7 days. See [When to revisit](#when-to-revisit).

## Checking that backups are running

- The hourly monitor opens an `ALERT: Backups` issue, which emails you, if no backup succeeded in 30 hours (October
  to December) or 5 days (otherwise) ([operations.md](operations.md#monitoring)).
- `planner-ops` → **Actions** → **Backup**: each run should be green, with "Backup <date>: <size>, encrypted." in its summary
  and a **backup** artifact.
- GitHub emails you when a scheduled run fails. The usual cause is a database password that was reset without
  updating `SUPABASE_DB_URL` ([secrets.md](secrets.md#reset-the-database-password)).

## Restoring

How long it takes: about 30 minutes for the database, by hand. Families keep using their device copies meanwhile;
their changes sync once the account is back.

**One family's plan, after a mistake** (most likely):
1. Download the backup from before the mistake: `planner-ops` → Actions → Backup → the run → Artifacts → **backup**. Unzip it.
2. Decrypt it in Git Bash: `gpg -d backup-<date>.tar.gz.gpg | tar -xz` (asks for the passphrase).
3. In `public-data.sql`, find the rows for that household's plan (`plan_id`). In the Supabase SQL Editor, replace that
   plan's rows in `saved_schools`, `visits`, `step_progress` and `school_notes` with those rows.
4. Ask the family to reload the planner.

**The whole project, after losing it:**
1. Create a new Supabase project, and apply every file in `supabase/migrations/` in order.
2. Recreate the people with the same IDs from `users.csv`, following Supabase's guide to migrating auth users.
   The IDs must match: households and sessions refer to them.
3. Run `public-data.sql` in the SQL Editor.
4. Point the app at the new project: update `src/config.js` (URL, publishable key, session key). Redo the setup in
   [supabase/README.md](../supabase/README.md) (URL configuration, email), then run `node scripts/check-supabase.js`.
5. Delete the decrypted files: they hold everyone's data, unencrypted.

## The restore drill

Do it once now, then every August (it's on the new-cycle checklist): download the latest backup, decrypt it, and
check that both files open. It proves both that backups are being made and that the passphrase you saved works.
Steps: [secrets.md](secrets.md#restore-drill-once-then-every-august).

## Supabase project pausing

Supabase pauses a free project after about a week without database activity. Nothing is lost (a paused project
can be resumed for up to a year), but signing in and syncing fail ("Couldn't reach your account") until you resume
it. Families keep working on their device copies meanwhile.

**How it's prevented:** the monitor queries the database every hour, and each backup's dump counts as activity too.

**How you'd be warned,** in order:
1. Supabase emails the account owner before pausing. Make sure email from supabase.com never goes to spam (in Gmail:
   search `from:supabase.com`, then "Create filter" → "Never send it to Spam").
2. If it pauses anyway, within an hour the monitor opens `ALERT: Supabase up` and `ALERT: Database reachable`.

**To fix:** Supabase dashboard → the project → **Resume project**. The alerts close on the next hourly run.

**A trap that no longer applies:** GitHub turns off scheduled workflows in a *public* repository after 60 days
without a commit. *Backup* and *Monitor* now run in a private repository, where that doesn't happen. *Watch sources*
in the public repository can still be turned off; see [operations.md](operations.md#the-year-at-a-glance).

## When to revisit

Size isn't the limit: even 100,000 households would be about 200 MB, a dump of a minute or two. Rethink backups when:

- **There are more than about 100 households,** or losing a day of changes becomes unacceptable.
- **You move to a paid Supabase plan.**

The plan then:
- Move to Supabase Pro, for daily backups kept 7 days. Add point-in-time recovery when even a day of loss matters.
- Keep any extra off-site copy in private storage that deletes old copies automatically, or drop it.
- Write down how long a restore takes, and run the drill on a copy of the project.
