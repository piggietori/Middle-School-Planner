# Failure modes

Everything we know of that can go wrong, how we'd find out, what we do, and how much risk is left. It's a register to
keep up to date: re-score a row when something changes, and after any real incident.

## How it's scored

Each failure gets three scores from 1 to 10, as in an FMEA. Multiplied, they give its **risk priority number**:
**RPN = S × O × D** (1 to 1000).

| Score | **S**: severity, for a family | **O**: occurrence, in application season (Nov – Dec 11) | **D**: detection, how likely it reaches families before we know |
|---|---|---|---|
| 9–10 | Data seen by others (10); a plan lost for good, or a missed deadline because of us (9) | Expected every week | We wouldn't know |
| 7–8 | Wrong information acted on (a wrong date); nobody can sign in or save | Likely at least once | Only if a family tells us |
| 5–6 | A feature broken for many, with a way around it | Possible | The daily report or the browser check, within hours |
| 3–4 | One family affected, or an annoyance | Unlikely: something guards against it | An alert within the hour |
| 1–2 | Cosmetic, or only the owner notices | Practically never | Caught before release (CI, review) |

**Rules:**
- **Act** on anything with RPN ≥ 100, or S ≥ 9 with D ≥ 5: before the pilot if possible, otherwise before sharing
  more widely.
- **Accepting a risk** instead needs a reason, written in the row.
- **"Now"** is the planner as of v1.2.0 with the monitor. **"After"** is once the fix in the Status column is done.
- **When to re-score:** each week in season (with the daily report), in the August checklist, and after any incident.

## Highest risks

Sorted by RPN after the planned fixes: what's still worth watching.

| ID | Failure | RPN now → after | What's left to do |
|---|---|---|---|
| F-31 | A school changes an open house and we miss it | 160 → 160 | Watched daily in season since v1.3.0. Left: changes only posted where the watch can't look (social media, school emails); feedback "wrong date" |
| F-12 | Signed out without choosing it (Safari, cleared data) | 147 → 147 | Accepted: common, but the planner explains it and signing in restores the plan |
| F-10 | The sign-in email doesn't arrive | 336 → 140 | Check delivery with the pilot families (the gate in [launch.md](launch.md)) |
| F-05 | The app breaks only for signed-out visitors | 192 → 120 | Accepted after the browser check: signed-out visitors send nothing, by design |
| F-30 | We publish a wrong date | 144 → 120 | Accepted: review and checks catch most; the pilot notice says to confirm with schools |
| F-52 | An alert arrives and nobody sees it | 224 → 112 | Turn on GitHub Mobile notifications for `planner-ops` |

## The register

Status: **Covered**, **Partial** (works, with a known gap), **Gap → fix**, **Accepted** (with the reason).

### The site

| ID | Failure | Harm | How we'd know | Response | S | O | D | RPN now | After | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| F-01 | The site is down (GitHub Pages, DNS) | Nobody can open it; saved plans are safe | `ALERT: Site up`, within the hour | githubstatus.com; check DNS ([operations.md](operations.md#when-something-breaks)) | 7 | 3 | 3 | 63 | 63 | Covered |
| F-02 | A merge breaks the app | Everyone sees a broken page | CI blocks most; `ALERT: App works for visitors` within 3 hours | Revert the pull request | 7 | 3 | 7 | 147 | 63 | Covered by the browser check |
| F-03 | "The planner couldn't load" (a file fails to load) | Nothing works; nothing is reported, because logging hasn't started | `ALERT: App works for visitors` | Check the last deploy; revert | 6 | 3 | 7 | 126 | 72 | Covered by the browser check |
| F-04 | A JavaScript error, signed in | One feature fails for some | `client_errors`; `ALERT: Errors from families` | Fix; post a banner if many are affected | 5 | 5 | 3 | 75 | 75 | Covered |
| F-05 | A JavaScript error only signed-out visitors hit | As F-04, but unseen | The browser check (main paths, Chromium and Safari); feedback | As F-04 | 6 | 4 | 8 | 192 | 120 | Accepted: we don't collect anything from signed-out visitors ([privacy.md](privacy.md)) |
| F-06 | The CSP blocks something a change needs | A feature or style breaks | CI (the tests run under the CSP); signed-in reports "CSP blocked …" | Add it to the policy ([security.md](security.md#content-security-policy)) | 5 | 3 | 2 | 30 | 30 | Covered |
| F-07 | The domain lapses | The site and sign-in emails stop | The registrar's renewal emails; then `ALERT: Site up` | Renew at the registrar | 8 | 2 | 3 | 48 | 48 | Covered: auto-renew on |
| F-08 | The HTTPS certificate fails or expires | Browsers warn or refuse | `ALERT: HTTPS certificate`, 14 days ahead | GitHub → Pages: custom domain, Enforce HTTPS | 7 | 2 | 3 | 42 | 28 | Covered |

### Sign-in and saving

| ID | Failure | Harm | How we'd know | Response | S | O | D | RPN now | After | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| F-10 | The sign-in email doesn't arrive (spam, Resend, rate limit) | Can't sign in on a new device | Daily report: sign-ins per day; "Tell us" on sign-in errors; Resend → Logs | [operations.md](operations.md#when-something-breaks) | 7 | 6 | 8 | 336 | 140 | Partial → confirm delivery with pilot families |
| F-11 | The code doesn't work (mistyped, expired, or the email is slow) | Can't sign in until they try again | Only if they tell us ("Tell us") | The planner says what went wrong; send a new email. Sign-in is by code only since v1.3.0, so link checkers and links opening in the wrong browser can't get in the way | 4 | 3 | 7 | 84 | 84 | Covered |
| F-12 | Signed out without choosing it (Safari's 7 days, cleared site data) | Worry that the plan is lost | Not reported | The planner says so and offers to sign in again (v1.1.1) | 3 | 7 | 7 | 147 | 147 | Accepted: handled in the app |
| F-13 | Saves fail | Changes stay on one device | `ALERT: Saves failing` | Supabase status; recent database changes | 7 | 3 | 3 | 63 | 63 | Covered |
| F-14 | Combining plans goes wrong at sign-in | Schools missing or doubled | Unit tests on every change; otherwise only if a family tells us | Restore their plan ([backups.md](backups.md#restoring)) | 8 | 2 | 6 | 96 | 96 | Covered by tests |
| F-15 | Supabase paused or down | Can't sign in or sync; device copies keep working | `ALERT: Supabase up`, `Database reachable` | Resume the project ([backups.md](backups.md#supabase-project-pausing)) | 7 | 2 | 3 | 42 | 42 | Covered |
| F-16 | The browser won't store anything (private mode, storage full) | The plan isn't kept between visits | Not reported | The planner keeps working for the visit | 4 | 2 | 9 | 72 | 72 | Accepted: rare, and signing in keeps the plan |
| F-17 | A pilot family wasn't invited | "Invite-only" message | "Tell us" on the message; they'll ask you | Invite them ([operations.md](operations.md#invite-only)) | 4 | 5 | 8 | 160 | 80 | Covered |

### The database and backups

| ID | Failure | Harm | How we'd know | Response | S | O | D | RPN now | After | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| F-20 | Row-level security opened by mistake | Families' plans readable by others | Database tests in CI; `ALERT: Security unchanged` hourly | Revert the migration; [secrets.md](secrets.md#if-a-secret-may-have-leaked) | 10 | 2 | 2 | 40 | 40 | Covered |
| F-21 | The retention job stops | Logs kept longer than we promise | `ALERT: Retention job` | Check `cron.job_run_details` | 2 | 3 | 3 | 18 | 18 | Covered |
| F-22 | The database fills up (500 MB) | Saves fail | `ALERT: Capacity` at 400 MB | Prune, or Supabase Pro | 6 | 1 | 3 | 18 | 18 | Covered |
| F-23 | The Supabase project is lost | Accounts gone until restored | Everything alerts | Restore the whole project ([backups.md](backups.md#restoring)) | 9 | 1 | 3 | 27 | 27 | Covered |
| F-24 | Backups stop | Nothing to restore from if something else goes wrong | `ALERT: Backups` after 30 hours | [operations.md](operations.md#when-something-breaks) | 8 | 3 | 3 | 72 | 72 | Covered |
| F-25 | A backup can't be opened (wrong or lost passphrase) | No restore possible | Only when we need it | The restore drill | 9 | 2 | 9 | 162 | 36 | Gap → the restore drill, before the pilot |

### Getting the information right

| ID | Failure | Harm | How we'd know | Response | S | O | D | RPN now | After | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| F-30 | We publish a wrong date or fact | A family goes at the wrong time | Review; data checks; feedback "A date or school detail is wrong" | Fix it, keep the `id`, add `was`; banner ([data-sources.md](data-sources.md)) | 8 | 3 | 6 | 144 | 120 | Accepted: the pilot notice says to confirm dates with the school |
| F-31 | A school changes an open house and we miss it | As F-30 | *Watch sources* daily October–December, weekly otherwise; feedback | As F-30 | 8 | 5 | 4 | 160 | 160 | Covered: daily in season. Pages it can't watch rely on feedback |
| F-32 | School facts go stale | Out-of-date details | Data checks warn after 400 days | The August checklist | 4 | 3 | 2 | 24 | 24 | Covered |

### Email

| ID | Failure | Harm | How we'd know | Response | S | O | D | RPN now | After | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| F-40 | Feedback isn't emailed (Vault secret, Resend key, hourly limit) | A family waits for an answer | `ALERT: Feedback not emailed` after an hour | Read it in the SQL Editor; [rotate the key](secrets.md#rotate-a-resend-key) | 4 | 3 | 6 | 72 | 36 | Covered |
| F-41 | Feedback is flooded with spam | Real messages are buried | `ALERT: Feedback flood` | Banner and turn the form off; add a CAPTCHA | 2 | 3 | 3 | 18 | 18 | Covered |
| F-42 | Resend's daily limit (100) is reached | Sign-in emails stop for the day | Daily report: sign-ins drop; Resend's dashboard | Resend's paid plan | 7 | 2 | 8 | 112 | 84 | Partial: watch sign-ins after sharing widely |

### Monitoring and operations

| ID | Failure | Harm | How we'd know | Response | S | O | D | RPN now | After | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| F-50 | The monitor stops running | Every other alert goes quiet | healthchecks.io emails when the hourly ping stops | Check `planner-ops` → Actions | 6 | 3 | 9 | 162 | 54 | Covered once `HEALTHCHECK_URL` is set |
| F-51 | GitHub turns off the public repo's scheduled workflows | The watch stops | The February–March check | Enable the workflow | 5 | 2 | 7 | 70 | 70 | Covered |
| F-52 | An alert arrives and nobody sees it | Any of the above lasts longer | Nothing | GitHub Mobile notifications; a Gmail filter marking alerts important | 7 | 4 | 8 | 224 | 112 | Gap → turn on GitHub Mobile notifications |
| F-53 | A dependency has a known vulnerability | Mostly the tests and workflows | Dependabot pull requests and alerts | Merge after CI passes | 3 | 3 | 3 | 27 | 27 | Covered |

### Security

| ID | Failure | Harm | How we'd know | Response | S | O | D | RPN now | After | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| F-60 | A secret is committed | Data exposed | Push protection blocks it; secret scanning alerts | [secrets.md](secrets.md#if-a-secret-may-have-leaked) | 9 | 2 | 7 | 126 | 36 | Gap → turn on secret scanning and push protection |
| F-61 | A GitHub Action we use is compromised | Our workflows run someone else's code | Unlikely to notice | Pin Actions to commit SHAs | 9 | 1 | 8 | 72 | 72 | Accepted until after December 11 ([security.md](security.md#known-gaps-and-what-to-do-about-them)) |
| F-62 | Someone sends sign-in emails to others' addresses | Unwanted emails | Supabase's rate limit; Resend's logs | Lower the limit; add a CAPTCHA | 3 | 2 | 6 | 36 | 36 | Covered |
| F-63 | The owner's GitHub, Supabase or email account is taken over | Everything | Login alerts from each service | 2FA; [secrets.md](secrets.md#if-a-secret-may-have-leaked) | 10 | 1 | 6 | 60 | 60 | Covered: 2FA on all |
| F-64 | A script is injected into the page | Sessions stolen | Tests; CSP; signed-in reports "CSP blocked …" | [security.md](security.md) | 10 | 1 | 2 | 20 | 20 | Covered |

### People

| ID | Failure | Harm | How we'd know | Response | S | O | D | RPN now | After | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| F-70 | The owner is unavailable in season | Alerts and feedback go unanswered | — | A second adult with the passphrase and these docs ([governance.md](governance.md)) | 6 | 3 | 5 | 90 | 90 | Partial until governance.md names the backup person and they've read it |

## Telemetry: what we collect, and what we deliberately don't

| Signal | From | Where it goes | Used by |
|---|---|---|---|
| Usage events (IDs only) and `sync_failed` | Signed-in families | `events` (1 year) | Daily report; `Saves failing` |
| Errors, including "CSP blocked …" | Signed-in families | `client_errors` (90 days) | `Errors from families`; daily report |
| Feedback | Anyone who sends it | `feedback` (1 year), emailed to the owner | The owner; `Feedback flood`, `Feedback not emailed` |
| The live site in Chromium and Safari | A robot visitor, every 3 hours | `ALERT: App works for visitors` | F-02, F-03, F-05 |
| Site, data, Supabase, certificate, security, database, backups | The monitor, hourly | `ALERT:` issues | [operations.md](operations.md#monitoring) |
| "The monitor ran" | The monitor, hourly | healthchecks.io | F-50 |

**Deliberately not collected:**
- **Anything from signed-out visitors.** No analytics and no error reports, as promised in the privacy notice. The
  browser check and the feedback form stand in for them.
- **Sign-in failures.** The person isn't signed in yet. The "Tell us" link and the daily sign-in count stand in.
