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
| A script injected into the page steals a session | Everything families type is escaped before it's shown. No third-party scripts run. The [Content-Security-Policy](#content-security-policy) blocks any script that isn't one of the site's own files, and stops scripts sending data anywhere but Supabase | `tests/e2e/security.spec.js` |
| A compromised library | The only runtime library (supabase-js) is copied into the repo at a fixed version by `scripts/vendor-supabase.js`, which records its checksum, so any change to it shows up in review. npm packages are used only for development and tests | — |
| A compromised workflow | Each workflow asks only for the permissions it needs (most only read). Secrets aren't available to pull requests from forks | Workflow files |
| Someone signs in as you | Sign-in is by a 6-digit code sent to your email, so it's as safe as your email. A code works once, expires after 30 minutes, and Supabase limits how fast codes can be tried. Anonymous sign-ins are off | Supabase settings, `check-supabase.js` |
| A lost or shared device | Signing out asks whether to remove the plan from the device. Delete my account removes it everywhere | `tests/e2e/account.spec.js` |
| A different person signs in on a device that still has someone's plan | The planner asks "Whose plan is on this device?" before adding it to the new account (F-19) | `tests/e2e/account.spec.js` |
| Someone fills the database so nobody can save | Size limits on notes and weights; hourly limits on feedback, events and error reports (`supabase/migrations/20261113120000_limits.sql`) | `tests/db/rls.test.js` |
| A wrong date or fact is published | Every data change is a reviewed pull request. Data checks catch removed IDs, impossible dates and stale text. The app shows where each number came from and when | [data-sources.md](data-sources.md) |
| Data is lost | [backups.md](backups.md) | Restore drill |

## Controls, layer by layer

**In the browser**
- The site holds only the project URL and the publishable key (`src/config.js`).
- Signed-out visitors never contact Supabase, except to send feedback they chose to send: the library isn't even
  downloaded. A browser test checks this. Feedback is sent without the account, and the `feedback` table can be
  written but not read through the API.
- Text from data files and from families (notes) goes through `esc()` before it becomes HTML.
- The sign-in session is kept in `localStorage`. That's normal for a site without its own server, and it's why
  stopping script injection matters most.
- The planner has its own subdomain (`d20.torilam.com`), never a page under another site such as a portfolio at
  `torilam.com`: browser storage and sign-in belong to the exact address, so nothing else can read them.

**Sign-in**
- Emailed 6-digit codes only, so no passwords are stored anywhere, and no links: the two emails Supabase sends
  (**Magic Link** for a returning address, **Confirm signup** for a new one) show the code and no link. The other
  templates (invite, change email, reset password, reauthentication) aren't used.
- The planner never accepts a sign-in carried in the address (`detectSessionInUrl: false` in
  `src/sync/backend.js`). Otherwise someone could post a link that signs a family in to *their* account, and the
  plan on that device would be added to it (F-65 in [failure-modes.md](failure-modes.md)). Such a link gets "That
  sign-in link has expired" and the account library isn't even downloaded; `tests/e2e/account.spec.js` checks both.
- Supabase still asks for the site's address and allowed return addresses (URL Configuration): only the live site and
  `localhost` for development. Sign-in doesn't use them.
- Sign-in emails go through Resend, from our own domain, limited to 60 an hour in Supabase.
- During the pilot, new sign-ups are off: only invited addresses can sign in.

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
- `main` is protected by a ruleset: changes arrive only through pull requests whose CI check (`check`) passed;
  force pushes and deleting the branch are blocked, and nobody can bypass it.
- Workflows ask for the least access they need: CI and the watch only read, and the backup can't write to the repo.

## Known gaps and what to do about them

| Gap | Risk | Recommendation | When |
|---|---|---|---|
| Inline styles allowed by the CSP | Injected styles could change how the page looks (not run code) | Move the views' `style="…"` attributes into classes, then drop `'unsafe-inline'` | Later cleanup |
| The CSP is a `<meta>` tag, so it can't stop other sites framing the planner (`frame-ancestors`) | Clickjacking. Low risk: no one-click destructive actions, and deleting needs DELETE typed | A host that can set headers | If we move off GitHub Pages |
| Actions pinned to versions like `@v4`, not commit SHAs | A compromised Action version could run in our workflows | Pin to SHAs. Dependabot already proposes updates weekly (`.github/dependabot.yml`) | After December 11 |
| 2FA can't be required for the Supabase organization | Anyone added to the Supabase organization later could sign in without 2FA | Requiring it needs the Pro plan; until then keep 2FA on your own accounts | When you scale |
| No audit log | We can't see who changed what in a shared household | Add when households can be shared | v2 |
| No CAPTCHA on sign-in or feedback | Someone could send many sign-in emails or feedback messages. For sign-in that can use up the hourly and daily email limits, so nobody can sign in (F-62) | Supabase's limits (60 emails an hour), 20 feedback emails an hour, 200 feedback messages an hour, and the monitor's flood alert. Add a CAPTCHA if abuse appears | If needed |

## Content-Security-Policy

The `<meta http-equiv="Content-Security-Policy">` tag in `index.html` tells the browser what the page may run,
load and contact. GitHub Pages can't send security headers, so it's a tag instead.

| Rule | What it allows | What it stops |
|---|---|---|
| `default-src 'self'` | Only the site's own files, for anything not listed below | Everything from other sites |
| `script-src 'self'` | Only the site's own `.js` files | Inline `<script>`, `onclick="…"`-style handlers, `javascript:` links, `eval`, and scripts from anywhere else. This is what makes an injected script harmless |
| `connect-src 'self' https://mhhszsyjxximewcuynis.supabase.co` | Requests to the site and to our Supabase project | A script sending the sign-in session or a plan to any other server |
| `style-src 'self' 'unsafe-inline'` | The stylesheets, plus the `style="…"` attributes the views use | Stylesheets from other sites. Inline styles can't run code |
| `font-src 'self'` | The fonts in `fonts/` | Fonts from anywhere else |
| `img-src 'self' data:` | Images from the site, and inline `data:` images | Images that could leak data to other sites |
| `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` | — | Plugins, a `<base>` tag redirecting relative links, and forms posting elsewhere |

Links to Google Calendar, Maps, MySchools and school sites still work: following a link isn't covered by the policy.

**Seeing it work:** open the site, then DevTools (F12) → Console. A blocked script or request shows as
"Refused to execute…" or "Refused to connect…". Seeing none means nothing was blocked.

**When adding a service:** a new server the browser talks to (for example a new API) must be added to
`connect-src`; a script, stylesheet or font from another site needs its own rule (better: copy it into the repo, as
`scripts/vendor-supabase.js` and `scripts/vendor-fonts.js` do). Moving to a new Supabase project means changing the
address here as well as in `src/config.js`. Server-side services, like a custom email sender, need no change.
Test it locally (`npm run dev`, Console open) before opening the pull request; `tests/e2e/security.spec.js` checks
the policy still blocks inline scripts.

**Other defenses against malicious script:**
- Everything a family types goes through `esc()` (`src/util.js`) before it becomes HTML, and attributes always use
  double quotes. Values that aren't escaped are numbers, IDs the database restricts (school codes, ratings 0–5), or
  text from the reviewed data files.
- The only library, supabase-js, is copied into the repo at a fixed version; nothing loads from a CDN.
- Signed-out visitors' browsers contact no server but the site itself (a browser test checks this).

## Checking it

- Every pull request: the row-level security tests and the "signed-out visitors make no requests" browser test run in CI.
- After every database change: `node scripts/check-supabase.js` must print "All checks passed".
- Yearly (August checklist): the restore drill, check that 2FA is still on, and check the `main` ruleset is still active.
