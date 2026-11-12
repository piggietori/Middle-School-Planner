# Supabase (accounts)

The planner keeps each household's plan in a Supabase project: `https://mhhszsyjxximewcuynis.supabase.co`.
Signed-out visitors never talk to it. School data is not here; it lives in `data/*.json`.

## What's here

- `migrations/`: the database, as SQL, applied in filename order. Never edit one that has been applied; add a new file.
- Tests: `tests/db/rls.test.js` runs every migration in Postgres (PGlite) and checks that people can reach only their own household's data. It runs with `npm test` and in CI.

## Keys

- The **publishable key** (`sb_publishable_...`) is in `src/config.js`. It is public by design.
- The **secret key** (`sb_secret_...`, or `service_role`) bypasses all access rules. Never put it in the code, a chat or a pull request. If something ever needs it, add it as a GitHub Actions secret yourself.
- Every secret, where it lives, and what to do if one is lost or leaked: [docs/secrets.md](../docs/secrets.md).

## Setting up a project (once)

1. **Apply the migrations.** Dashboard → SQL Editor → New query → paste each file in `migrations/` in order → Run. Expect "Success. No rows returned."
2. **Check it from outside.** `node scripts/check-supabase.js` should print "All checks passed".
3. **The site's address.** (Sign-in is by code, but Supabase still needs it.) Dashboard → Authentication → URL Configuration:
   - Site URL: `https://d20.torilam.com/` (before the custom domain: `https://piggietori.github.io/Middle-School-Planner/`)
   - Redirect URLs: add `https://d20.torilam.com/**` and `http://localhost:5173/**`
4. **Sign-in emails.** Authentication → Sign In / Providers → Email stays on. Supabase's built-in sender allows only a few emails an hour, so sign-in emails go through Resend instead: Authentication → Emails → **SMTP Settings**. The steps, and the email's wording, are in [docs/launch.md](../docs/launch.md#before-the-pilot). The Magic Link and Confirm signup emails (a returning address gets the first, a new one the second) must both show `{{ .Token }}`, the code the planner asks for, and no link: the planner doesn't accept links.

5. **Backups.** The free plan has no backups of its own (the Pro plan adds daily backups kept 7 days). The
   *Backup* workflow makes an encrypted one instead: daily in October to December (application season), twice a week otherwise.
   It lives in the **private** `planner-ops` repository, so only you can download the backups. To turn it on, add two
   secrets to that repository yourself (`planner-ops` → Settings → Secrets and variables → Actions → New repository secret):
   - `SUPABASE_DB_URL`: Dashboard → **Connect** → **Session pooler** connection string, with your database password
     in place of `[YOUR-PASSWORD]`. (Use the pooler: GitHub's runners can't reach the direct connection.)
   - `BACKUP_PASSPHRASE`: a long passphrase. Keep it in a password manager: without it a backup can't be opened,
     and with it anyone could read one.

   You don't need to keep the database password: you can reset it any time. The passphrase can't be reset.
   See [docs/secrets.md](../docs/secrets.md).

   Then `planner-ops` → Actions → *Backup* → Run workflow, and check the run shows "Backup …, encrypted." How backups work and
   how to restore one: [docs/backups.md](../docs/backups.md).

6. **Feedback emails.** The *Send feedback* form saves to the `feedback` table, and the database emails each message
   to you through Resend (`email_feedback()`, using the pg_net extension). It needs three Vault secrets, which you add
   yourself in the SQL Editor; the values never go in a file: `resend_api_key`, `feedback_to` and `feedback_from`
   ([docs/launch.md](../docs/launch.md#before-the-pilot), step 5). Until they're set, feedback is saved but not emailed.

7. **The clock.** GitHub runs scheduled workflows late, so the database starts the monitor, the backup and the source
   watch itself (`run_workflow()`, pg_cron and pg_net). It needs one more Vault secret, `github_actions_token`
   ([docs/secrets.md](../docs/secrets.md#the-clocks-github-token)). Until it's set, the clock does nothing.

## Usage and errors

Signed-in people's devices add rows to `events` (a few kinds, IDs only: see docs/journeys.md) and `client_errors`.
Signed-out visitors send nothing. Nobody can read these through the API; look in the SQL Editor:

```sql
select name, count(*) from events where at > now() - interval '7 days' group by name order by 2 desc;
select at, message, context from client_errors order by at desc limit 20;
select at, kind, message, reply_to, page, emailed from feedback order by at desc limit 20;
```

The `feedback` table can be written by anyone, signed in or not, but read only here. If `emailed` is false, the email
failed or the hourly limit (20) was reached: read it here.

## Restoring a backup

See [docs/backups.md](../docs/backups.md#restoring).

## Adding a change to the database

1. Add `migrations/<yyyymmddhhmmss>_<what>.sql`. Give every new table row-level security and policies in the same file.
2. Add cases to `tests/db/rls.test.js` and run `npm test`.
3. After the pull request is merged, paste the new file into the SQL Editor, then run `node scripts/check-supabase.js`.
