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
| Database password | Replaceable | GitHub secret `SUPABASE_DB_URL` only | No | [Reset it](#reset-the-database-password) | [Reset it](#reset-the-database-password) right away |
| Supabase secret key (`sb_secret_…`, `service_role`) | Replaceable, unused | Supabase dashboard only | No | Not used anywhere | Rotate it: Project Settings → API Keys |
| **Backup passphrase** | **Irreplaceable** | GitHub secret `BACKUP_PASSPHRASE` and the password manager | **Yes** | Existing backups can never be opened. [Make a new one](#change-the-backup-passphrase); only new backups use it | Anyone with a downloaded backup can read it. [Change it](#change-the-backup-passphrase); old backups expire within 90 days |
| Supabase account login | Master key | Password manager, with 2FA | Yes | Recover by email | They could reset everything above |
| GitHub account | Master key | Password manager, with 2FA | Yes | Recover by email | They could read and change secrets and workflows |
| Your email account | Master key | Password manager, with 2FA | Yes | Your provider's recovery | Sign-in links go there, so it protects your planner account too |

**Notes**
- **The database password doesn't need to be remembered.** The app never uses it. Only the backup uses it, through
  `SUPABASE_DB_URL`, and resetting it is free and harmless.
- **The backup passphrase is the one to guard.** GitHub never shows it again, and nobody can reset it. Share its
  password manager entry with a second adult in the household, so the backups stay usable if you're unavailable.
- **Changing the passphrase doesn't re-encrypt old backups.** Keep the old one, labeled with the date it was
  replaced, for 90 days, until the last backup made with it expires.
- **A failed backup emails you.** GitHub notifies you when a scheduled run fails. The usual cause is a reset
  database password that wasn't updated in `SUPABASE_DB_URL`.

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
3. GitHub → Settings → Secrets and variables → Actions → `SUPABASE_DB_URL` → **Update**, paste it, and save.
4. Actions → **Backup** → Run workflow. Check that it succeeds.

### Change the backup passphrase

1. Generate a new passphrase in the password manager and **save it there first**.
2. Rename the old entry to "… (replaced <date>, keep until <date + 90 days>)".
3. GitHub → Settings → Secrets and variables → Actions → `BACKUP_PASSPHRASE` → **Update**.
4. Actions → **Backup** → Run workflow. Check that it succeeds.

### Restore drill (once, then every August)

1. Actions → the latest **Backup** run → Artifacts → download **backup** and unzip it.
2. In Git Bash, in that folder: `gpg -d backup-<date>.tar.gz.gpg | tar -xz`, and enter the passphrase.
3. Check that `users.csv` and `public-data.sql` are there and readable.
4. Delete the files: they hold the household's data, unencrypted.

To restore into a project, see [supabase/README.md](../supabase/README.md#restoring-a-backup).

### If a secret may have leaked

1. [Reset the database password](#reset-the-database-password).
2. Rotate the Supabase secret key (Project Settings → API Keys), even though it's unused.
3. If a backup file or the passphrase might be out, [change the passphrase](#change-the-backup-passphrase).
4. Supabase → Authentication → Users: delete any account you don't recognize.
5. If a master key leaked, change that password first, then check that 2FA is still on.
