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
3. **Allow the sign-in links to come back to the site.** Dashboard → Authentication → URL Configuration:
   - Site URL: `https://piggietori.github.io/Middle-School-Planner/`
   - Redirect URLs: add `https://piggietori.github.io/Middle-School-Planner/**` and `http://localhost:5173/**`
4. **Sign-in emails.** Authentication → Sign In / Providers → Email stays on. Supabase's built-in email sender is limited to a few emails an hour, which is fine for one household. Before opening to the public, set up custom SMTP (Authentication → Emails → SMTP Settings).

5. **Backups.** The free plan has no backups of its own (the Pro plan adds daily backups kept 7 days). The
   *Backup* workflow (`.github/workflows/backup.yml`) makes an encrypted one instead: daily in October to December (application season), twice a week otherwise. To turn it on, add two
   repository secrets yourself (GitHub → Settings → Secrets and variables → Actions → New repository secret):
   - `SUPABASE_DB_URL`: Dashboard → **Connect** → **Session pooler** connection string, with your database password
     in place of `[YOUR-PASSWORD]`. (Use the pooler: GitHub's runners can't reach the direct connection.)
   - `BACKUP_PASSPHRASE`: a long passphrase. Keep it in a password manager: without it a backup can't be opened,
     and with it anyone could read one.

   You don't need to keep the database password: you can reset it any time. The passphrase can't be reset.
   See [docs/secrets.md](../docs/secrets.md).

   Then Actions → *Backup* → Run workflow, and check the run shows "Backup …, encrypted." How backups work and
   how to restore one: [docs/backups.md](../docs/backups.md).

## Usage and errors

Signed-in people's devices add rows to `events` (a few kinds, IDs only: see docs/journeys.md) and `client_errors`.
Signed-out visitors send nothing. Nobody can read these through the API; look in the SQL Editor:

```sql
select name, count(*) from events where at > now() - interval '7 days' group by name order by 2 desc;
select at, message, context from client_errors order by at desc limit 20;
```

## Restoring a backup

See [docs/backups.md](../docs/backups.md#restoring).

## Adding a change to the database

1. Add `migrations/<yyyymmddhhmmss>_<what>.sql`. Give every new table row-level security and policies in the same file.
2. Add cases to `tests/db/rls.test.js` and run `npm test`.
3. After the pull request is merged, paste the new file into the SQL Editor, then run `node scripts/check-supabase.js`.
