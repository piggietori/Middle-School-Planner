# Security

How a family's data is protected, what could go wrong, and what's still to do.
For the keys and passwords themselves, see [secrets.md](secrets.md). For what personal data exists, see [privacy.md](privacy.md).

## What we protect

1. **A family's plan:** their schools, visits, steps, and the notes they write about schools. Notes are private
   opinions.
2. **Their email address,** the only thing that identifies them.
3. **The integrity of the dates families rely on.** A wrong deadline or open house time does real harm, even though
   it's public data.

## What could go wrong, and what stops it

| Threat | What stops it | Proven by |
|---|---|---|
| Another family reads or changes your plan | Row-level security on every table: you reach only rows of households you belong to | `tests/db/rls.test.js` (in CI) |
| Someone joins your household, or creates a plan for it | No insert policy on `household_members` or `plans`; only `open_plan()` creates them, and only for yourself | `tests/db/rls.test.js` |
| A signed-out visitor probes the database API | Every table refuses the `anon` role; functions can't be called signed out | `scripts/check-supabase.js` against the live project |
| The key in the website is misused | It's the publishable key, made to be public: it can do only what row-level security allows a signed-out visitor, which is nothing | Same |
| The secret key or database password leaks | Neither is in the code or the site. The secret key isn't used anywhere; the database password is only in a GitHub secret | [secrets.md](secrets.md) |
| A script injected into the page steals a session | Everything families type and everything from data files is escaped before it's shown. No third-party scripts run. A Content-Security-Policy is still to do (below) | Code review |
| A compromised library | The only runtime library (supabase-js) is copied into the repo at a fixed version by `scripts/vendor-supabase.js`, which records its checksum, so any change to it shows up in review. npm packages are used only for development and tests | — |
| A compromised workflow | Each workflow asks only for the permissions it needs (most only read). Secrets aren't available to pull requests from forks | Workflow files |
| Someone signs in as you | Sign-in is by emailed link, so it's as safe as your email. Links work once and expire in an hour. Links only send people back to our own site's addresses. Anonymous sign-ins are off | Supabase settings, `check-supabase.js` |
| A lost or shared device | Signing out asks whether to remove the plan from the device. Delete my account removes it everywhere | `tests/e2e/account.spec.js` |
| A wrong date or fact is published | Every data change is a reviewed pull request. Data checks catch removed IDs, impossible dates and stale text. The app shows where each number came from and when | [data-sources.md](data-sources.md) |
| Data is lost | [backups.md](backups.md) | Restore drill |

## Controls, layer by layer

**In the browser**
- The site holds only the project URL and the publishable key (`src/config.js`).
- Signed-out visitors never contact Supabase: the library isn't even downloaded. A browser test checks this.
- Text from data files and from families (notes) goes through `esc()` before it becomes HTML.
- The sign-in session is kept in `localStorage`. That's normal for a site without its own server, and it's why
  stopping script injection matters most.

**Sign-in**
- Emailed links only, so no passwords are stored anywhere.
- Allowed return addresses are set in Supabase (URL Configuration): only the live site and `localhost` for development.
- Supabase limits how many sign-in emails can be sent: about 2 an hour on the built-in sender.

**In the database** ([supabase/migrations/](../supabase/migrations/))
- Row-level security is on for every table, with policies for signed-in people only.
- Grants match the policies: a signed-in person can't even try what no policy allows, such as inserting a household.
- Helper functions are `security definer` with a fixed, empty `search_path`, so they can't be tricked into using
  another schema.
- Check constraints reject bad values: school codes, ratings 0–5, text lengths, event names.
- `events` and `client_errors` are insert-only, and only for yourself. Nobody can read them through the API.
- Deleting an account happens in one transaction: all of it or none of it.

**In transit and at rest**
- Everything travels over HTTPS (TLS): GitHub Pages and Supabase.
- Supabase encrypts the database and its storage at rest (AES-256).
- Backups are encrypted (gpg, AES-256) before they leave GitHub's runner. Only the passphrase opens them.

**In GitHub**
- Changes reach `main` through pull requests, with CI run on each. (Not yet enforced: see the gaps below.)
- Workflows ask for the least access they need: CI and the watch only read, and the backup can't write to the repo.

## Known gaps and what to do about them

| Gap | Risk | Recommendation | When |
|---|---|---|---|
| No Content-Security-Policy | If a script were ever injected, nothing would stop it from sending the session elsewhere | Add a CSP `<meta>` tag allowing only this site, Supabase and Google Fonts | Soon: small change |
| Google Fonts loaded from Google | Google sees every visitor's IP address, signed in or not | Serve the two fonts from the site | With the CSP |
| Actions pinned to versions like `@v4`, not commit SHAs; no Dependabot | A compromised Action version could run in our workflows | Pin to SHAs and turn on Dependabot for Actions and npm | Soon |
| `main` isn't a protected branch | A direct push could skip CI | Settings → Branches → protect `main`: require the CI check and pull requests | Soon: settings only |
| 2FA not required | A stolen GitHub or Supabase password exposes everything | Turn on 2FA for both accounts | Now: you |
| Built-in email sender | Rate-limited; emails may land in spam | Custom SMTP (for example Resend) | Before public launch |
| No audit log | We can't see who changed what in a shared household | Add when households can be shared | v2 |
| No privacy policy | Required before strangers use it | Write it from [privacy.md](privacy.md) | Before public launch |

## Checking it

- Every pull request: the row-level security tests and the "signed-out visitors make no requests" browser test run in CI.
- After every database change: `node scripts/check-supabase.js` must print "All checks passed".
- Yearly (August checklist): the restore drill, and check that 2FA is still on.
