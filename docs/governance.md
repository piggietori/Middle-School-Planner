# Who runs the planner, and who steps in

The planner has one owner. This page says who steps in when the owner can't (sick, travelling, offline), what they can
do, and what they can't. It covers F-70 in [failure-modes.md](failure-modes.md). The owner reads it once each August
and before each season (October), and updates the names.

## People

| Role | Who | Has |
|---|---|---|
| Owner | _(the owner's name)_ | Every account: GitHub (`piggietori`), Supabase, Resend, Porkbun, healthchecks.io, the Gmail that gets alerts and feedback |
| Backup | _(the second adult's name)_ | The backup passphrase ([secrets.md](secrets.md)). Nothing else unless the owner adds them (below) |

**Never share** the owner's passwords or 2FA codes. If the backup needs to act, the owner gives them their own access.

## What the backup can do

**With no accounts** (enough for a week away in season):
- Tell families. Answer pilot families and parent-group chats directly: "The planner has a problem; your plan is safe on
  your device. Please check dates with the schools."
- Keep the passphrase safe. It's the only way to open a backup, and it can't be reset.

**With a GitHub account added to the public repository** (Settings → Collaborators, role *Write*; the `main` ruleset
still needs a pull request):
- **Post a banner**: edit `data/notice.json` in a pull request and merge it ([operations.md](operations.md#the-banner)).
- **Undo a bad change**: on the pull request that broke things, **Revert**, then merge the revert.
- Read alerts: add them to `planner-ops` too (Settings → Collaborators, *Read*), and they Watch → All activity.

**With a Supabase organization invite** (after they turn on 2FA; pick the lowest role that can change Authentication
settings, which on the free plan is *Administrator*: check Supabase's role table when you invite them):
- **Turn sign-ups off** if something is wrong with accounts: Authentication → Sign In / Providers.
- **Resume a paused project**: the project → Resume.

## What the backup doesn't do
- Change the database, the email setup or any secret. Those wait for the owner.
- Restore a backup. Only if the owner asks, following [backups.md](backups.md#restoring).
- Delete anyone's account or data. A family can do that themselves (Account → Delete my account).

## If the owner is gone for longer
If the owner can't come back before December 11, the backup posts a banner saying the planner won't be updated
this season. Families keep their plans: each one can **Download my data** from the account sheet. Then, with
the owner's family, decide whether to hand the accounts over or shut the planner down after December 11.
