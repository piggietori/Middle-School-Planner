# Launch: from one household to a pilot to parent groups

What has to be true before other families use the planner, the order to do it in, and when it's safe to share
more widely. Fill in each step's date as you go.

## Before the pilot

**Accounts and settings (the owner):**

| Step | How | Done |
|---|---|---|
| 1. A domain | `torilam.com`, at Porkbun: auto-renew on. Add email forwarding for `help@torilam.com` to your own inbox. The root is kept for a portfolio; the planner gets its own subdomain ([security.md](security.md#controls-layer-by-layer)) | |
| 2. Sign-in emails from the domain | Resend (free): add the domain `mail.torilam.com`, paste its DNS records (SPF, DKIM), create an SMTP key. Supabase → Authentication → **SMTP Settings**: host `smtp.resend.com`, port 465, user `resend`, password the key, sender `D20 Planner <signin@mail.torilam.com>`. Then **Rate Limits** → emails per hour: 30 | |
| 3. The sign-in email's words | Supabase → Authentication → Emails → **Magic Link**: subject "Your sign-in link for the D20 Middle School Planner"; say who it's from, that the link works once for an hour, and to ignore it if they didn't ask | |
| 4. The site's address: `d20.torilam.com` | Porkbun DNS: delete the parking wildcard `*` CNAME, add `CNAME d20 → piggietori.github.io`. GitHub profile → Settings → Pages → **Verified domains**: add `torilam.com` with its TXT record. Repo → Settings → Pages → Custom domain `d20.torilam.com` → **Enforce HTTPS**. Supabase → URL Configuration: Site URL `https://d20.torilam.com`, Redirect URLs `https://d20.torilam.com/**` (keep `localhost`). Planner-ops variable `SITE_URL`: `https://d20.torilam.com/`. You'll need to sign in again once, because each address keeps its own copy | 2026-11-11 |
| 5. Feedback emails | Resend → API Keys → create one with **Sending access** for the domain only. In the Supabase SQL Editor, run (with your values, never in a file or chat): `select vault.create_secret('<the key>', 'resend_api_key'); select vault.create_secret('<your email>', 'feedback_to'); select vault.create_secret('D20 Planner <feedback@mail.torilam.com>', 'feedback_from');` | |
| 6. The private ops repository | Create `piggietori/planner-ops`, **private**. Add secrets `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE`, and the variable `SITE_URL`. Delete both secrets from the public repo. **Watch → All activity**, so alerts email you | |
| 7. Invite-only for the pilot | Supabase → Authentication → Sign In / Providers → turn off **Allow new users to sign up**. Invite each family from **Users → Invite user** | |
| 8. Hear about problems | **healthchecks.io** (free): create a check with period 1 hour and grace 1 hour, and put its ping URL in the `planner-ops` secret `HEALTHCHECK_URL`. Public repo → Settings → **Code security**: turn on secret scanning and push protection. Install **GitHub Mobile** and allow notifications for `planner-ops` | |
| 9. The restore drill | Download the newest backup from the ops repo, decrypt it, check both files open ([backups.md](backups.md#the-restore-drill)) | |

**In the code (merged before the pilot):**
- `src/config.js`: `HELP_EMAIL` and `SUPABASE_REGION` filled in. A unit test fails until they are.
- The migrations applied in the SQL Editor, in order. Then `node scripts/check-supabase.js` passes.
- Release v1.2.0.

**Check it end to end:**
- Sign in on `d20.torilam.com` with an address you haven't used. The email comes from your domain within a minute, and not in spam.
- The old github.io link goes to the new address.
- With sign-ups off, an address you didn't invite gets "The planner is invite-only for now".
- Send feedback from the footer. It arrives in your inbox, and the reply address works.
- In the ops repo, run *Monitor* with "Also post the daily report": the checks pass and the report posts.
- Run *Monitor* with a wrong `site_url`: an `ALERT: Site up` issue opens and emails you. The next normal run closes it.
- Run *Monitor* with "Run the real-browser check instead": it passes. healthchecks.io shows the hourly pings.

## The pilot (fewer than 5 households, about a week)

- **The invite:** send each family the link with this note:

  > I'm testing a planner for our District 20 middle school applications: https://d20.torilam.com. It's a pilot, so it may have
  > mistakes. Please confirm dates with the schools, and remember the application itself is only in MySchools.
  > The "Send feedback" link at the bottom comes straight to me. I've invited your email address, so sign in with that.
- **Every morning:** read the daily report and any feedback. Answer feedback within a day.
- **When something's wrong:** use the alert issue's steps, or [operations.md](operations.md#when-something-breaks).
  For anything families should know, post a banner (`data/notice.json`).

## The gate to share with parent groups

All of these must be true:
- [ ] 3 days with no open alerts about the site, Supabase, security, saves or backups
- [ ] At least 2 pilot households signed in, and at least one used 2 devices
- [ ] Sign-in emails arrive within a minute, and not in spam (ask the pilot families)
- [ ] All feedback answered, and anything wrong fixed or on a banner
- [ ] The restore drill done
- [ ] `App works for visitors` has passed for 3 days
- [ ] The highest risks in [failure-modes.md](failure-modes.md#highest-risks) re-scored with what the pilot showed

## Sharing with parent groups

1. Turn **Allow new users to sign up** back on.
2. Decide whether to keep the Pilot label: `PILOT` in `src/config.js`. Keeping it through December 11 is reasonable.
3. Share the link, with the same note minus the invite sentence.
4. Keep reading the daily report every day until December 11.

## Not before December 11
- Sharing a plan between two parents (journey J4). Until then, both parents can sign in with the same email.
- Supabase Pro, a CAPTCHA, and moving inline styles out of the CSP. See [security.md](security.md#known-gaps-and-what-to-do-about-them).
