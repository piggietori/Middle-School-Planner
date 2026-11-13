# Secrets

What the planner's secrets are, where each one lives, and what to do when one is lost or leaked.
This file names secrets; it never contains their values.

## Three kinds

1. **Public by design.** Safe in the code. Nothing to do.
2. **Replaceable.** You don't need a copy: if you ever need it, reset it, then update the one place that uses it.
3. **Irreplaceable.** Keep it in the password manager. Losing it loses data; leaking it exposes data.

Above all of these are the **master keys**: the logins that can reset everything else. Protect them with 2FA.

| Secret | Kind | Lives in | Keep a copy? | If lost | If leaked |
|---|---|---|---|---|---|
| Supabase publishable key (`sb_publishable_…`) | Public | `src/config.js` | No | Copy it from the dashboard | Nothing: row-level security protects the data |
| Database password | Replaceable | `SUPABASE_DB_URL` secret in the private `planner-ops` repo only | No | [Reset it](#reset-the-database-password) | [Reset it](#reset-the-database-password) right away |
| Supabase secret key (`sb_secret_…`, `service_role`) | Replaceable, unused | Supabase dashboard only | No | Not used anywhere | Rotate it: Project Settings → API Keys |
| **Backup passphrase** | **Irreplaceable** | `BACKUP_PASSPHRASE` secret in `planner-ops`, and the password manager | **Yes** | Existing backups can never be opened. [Make a new one](#change-the-backup-passphrase); only new backups use it | Anyone with a downloaded backup can read it. [Change it](#change-the-backup-passphrase); old backups expire within 90 days |
| Resend SMTP key | Replaceable | Supabase → Authentication → SMTP Settings only | No | Create a new one in Resend and paste it there | Someone could send email as the domain: [rotate the Resend keys](#rotate-a-resend-key) |
| Resend API key (feedback emails) | Replaceable | Supabase Vault secret `resend_api_key` only. Sending access, for the domain only | No | Create a new one and [update the Vault secret](#rotate-a-resend-key) | Same as the SMTP key |
| Feedback addresses | Private, not secret | Supabase Vault secrets `feedback_to` (your inbox) and `feedback_from` | No | Set them again in the Vault | Nothing much: `feedback_to` would get spam |
| The clock's GitHub token | Replaceable | Supabase Vault secret `github_actions_token` only. A fine-grained token: these two repositories, **Actions: Read and write**, nothing else | No | [Make a new one](#the-clocks-github-token) | Someone could start or cancel the workflows (not read their secrets or change code). Revoke it in GitHub and make a new one |
| Supabase account login | Master key | Password manager, with 2FA | Yes | Recover by email | They could reset everything above |
| GitHub account | Master key | Password manager, with 2FA | Yes | Recover by email | They could read and change secrets and workflows |
| Resend account | Master key | Password manager, with 2FA | Yes | Recover by email | They could send email as the domain and read who was emailed |
| Domain registrar | Master key | Password manager, with 2FA. Turn on auto-renew | Yes | Recover by email | They could point the site and email somewhere else. If the domain lapses, the site and sign-in emails stop |
| Your email account | Master key | Password manager, with 2FA | Yes | Your provider's recovery | Sign-in codes go there, so it protects your planner account too |

**Notes**
- **The database password doesn't need to be remembered.** The app never uses it. Only the backup uses it, through
  `SUPABASE_DB_URL`, and resetting it is free and harmless.
- **The backup passphrase is the one to guard.** GitHub never shows it again, and nobody can reset it. Share its
  password manager entry with a second adult in the household, so the backups stay usable if you're unavailable.
- **Changing the passphrase doesn't re-encrypt old backups.** Keep the old one, labeled with the date it was
  replaced, for 90 days, until the last backup made with it expires.
- **A failed backup emails you.** GitHub notifies you when a scheduled run fails. The usual cause is a reset
  database password that wasn't updated in `SUPABASE_DB_URL`.

## Where secrets live

- **The public repository holds no secrets.** Its workflows (CI, deploy, watch, refresh, release) don't need any.
- **Your own shell** holds the Anthropic API key (`ANTHROPIC_API_KEY`) when you run the tag classifier or its
  eval ([testing.md](testing.md#tag-classifier-eval)). It is never written to a file here and never added to
  GitHub Actions; those scripts run by hand only.
- **The private `planner-ops` repository** holds the two that touch families' data: `SUPABASE_DB_URL` and
  `BACKUP_PASSPHRASE`. Its *Backup* and *Monitor* workflows use them. Only you can see it, its runs and its backup files.
- **Supabase** holds the email keys: the SMTP key in its settings, and the Resend API key and feedback addresses in
  its Vault, where only the database's own functions can read them.

## Never

- Never put a secret in the code, a commit, a pull request, an issue, or a chat with anyone, including an AI
  assistant. Only the publishable key belongs in the code.
- Never send a secret by email or text. Share it through the password manager.
- If a secret ends up somewhere it shouldn't, treat it as leaked even if you delete it: commit history and chats
  are kept.

## Procedures

### Reset the database password

1. Supabase → Project Settings → Database → **Reset database password**. Use letters and numbers only: symbols
   such as `@ # / ?` break the connection string.
2. Supabase → **Connect** → Connection String → Method: **Session pooler** → copy the string, and put the new
   password in place of `[YOUR-PASSWORD]`.
3. `planner-ops` → Settings → Secrets and variables → Actions → `SUPABASE_DB_URL` → **Update**, paste it, and save.
4. `planner-ops` → Actions → **Backup** → Run workflow. Check that it succeeds.

### Change the backup passphrase

1. Generate a new passphrase in the password manager and **save it there first**.
2. Rename the old entry to "… (replaced <date>, keep until <date + 90 days>)".
3. `planner-ops` → Settings → Secrets and variables → Actions → `BACKUP_PASSPHRASE` → **Update**.
4. `planner-ops` → Actions → **Backup** → Run workflow. Check that it succeeds.

### Restore drill (once, then every August)

1. `planner-ops` → Actions → the latest **Backup** run → Artifacts → download **backup** and unzip it.
2. In Git Bash, in that folder: `gpg -d backup-<date>.tar.gz.gpg | tar -xz`, and enter the passphrase.
3. Check that `users.csv` and `public-data.sql` are there and readable.
4. Delete the files: they hold the household's data, unencrypted.

To restore into a project, see [supabase/README.md](../supabase/README.md#restoring-a-backup).

### Rotate a Resend key

1. Resend → API Keys: create the new key (SMTP or **Sending access** for the domain), then delete the old one.
2. The SMTP key: paste it in Supabase → Authentication → SMTP Settings. Send yourself a sign-in code to check.
3. The API key: in the Supabase SQL Editor, run
   `select vault.update_secret((select id from vault.secrets where name = 'resend_api_key'), '<the new key>');`
   with the key typed there only. Send feedback from the planner to check it arrives.

### If a secret may have leaked

1. [Reset the database password](#reset-the-database-password).
2. Rotate the Supabase secret key (Project Settings → API Keys), even though it's unused.
3. If a backup file or the passphrase might be out, [change the passphrase](#change-the-backup-passphrase).
   If a Resend key might be out, [rotate it](#rotate-a-resend-key).
4. Supabase → Authentication → Users: delete any account you don't recognize.
5. If a master key leaked, change that password first, then check that 2FA is still on.


## The clock's GitHub token

The database starts the scheduled jobs on time by asking GitHub to run them ([operations.md](operations.md#monitoring),
F-55). For that it holds one GitHub token, which can run workflows in the two repositories and do nothing else.

1. GitHub → your picture → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** →
   Generate new token. Name: `planner clock`. Expiration: one year (put the date in your calendar: F-56).
   Repository access: **Only select repositories** → `Middle-School-Planner` and `planner-ops`.
   Permissions → Repository → **Actions: Read and write**. Nothing else.
2. In the Supabase SQL Editor (never in a file or a chat):
   `select vault.create_secret('<the token>', 'github_actions_token');`
   To replace it later: `select vault.update_secret((select id from vault.secrets where name = 'github_actions_token'), '<the new token>');`
3. Check it: `select public.run_workflow('planner-ops', 'monitor.yml', '{"clock": "true"}');` then, a few seconds later,
   `select created, status_code, left(content, 200) from net._http_response order by created desc limit 1;` shows **204**,
   and a Monitor run appears in `planner-ops` → Actions. A 401 means the token is wrong or expired; a 422 means
   `planner-ops` doesn't have the `clock` input yet (merge its pull request first).