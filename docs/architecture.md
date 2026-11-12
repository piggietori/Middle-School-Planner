# Architecture

How the planner is put together, what data lives where, and how a family's plan moves between their devices.
For the journeys this supports, see [journeys.md](journeys.md). For the outside services in plain words, see
[ecosystem.md](ecosystem.md).

## The picture

```
 ┌─────────────── SOURCE DATA (public) ──────────────────────────────────────┐
 │ NYC Open Data        D20 open house flyer     schools.nyc.gov/MS          │
 │ (test results)       (D20 website)            (key dates)                 │
 │ InsideSchools + NYC School Survey (facts, highlights, survey numbers)     │
 └───────┬───────────────────────┬───────────────────────────────────────────┘
         │ Refresh data          │ a person edits by hand
         │ (run by hand)         │ (prompted by the weekly watch or the August checklist)
         ▼                       ▼
 ┌─────────────── GITHUB REPOSITORY ─────────────────────────────────────────┐
 │ data/*.json  (every record says source and as_of)                         │
 │ src/  index.html  (no build step: these files are the site)               │
 │ supabase/migrations/  (the database, as SQL)                              │
 │                                                                           │
 │ CI on every pull request: lint · data checks · unit + database tests ·    │
 │                           browser journeys (desktop, phone, iPhone)       │
 │ Scheduled: Watch sources (Mon) · New admissions cycle (Aug 15)            │
 │ (Backup and the hourly Monitor run in the private planner-ops repo)       │
 └───────┬──────────────────────────────────────────────┬────────────────────┘
         │ Deploy on merge to main                      │ migrations pasted into
         ▼                                              ▼ the SQL Editor
 ┌──── GITHUB PAGES ─────────────┐        ┌──────── SUPABASE ───────────────────────┐
 │ index.html, privacy.html,     │        │ Auth: emailed sign-in codes             │
 │ src/, data/, fonts/           │        │ Postgres, row-level security on every   │
 └──────────────┬────────────────┘        │ table:                                  │
                │ loads                   │  households, household_members          │
                ▼                         │  plans (one per household per cycle)    │
 ┌──────────── BROWSER ───────────────┐   │  saved_schools, visits, step_progress,  │
 │ Home · Dates · Find · My list      │   │  school_notes                           │
 │ match score (pure functions)       │   │  user_session (where you left off)      │
 │ plan in localStorage (always)      │◄─►│  events, client_errors (insert only)    │
 │ sync with the account (signed in)  │   │  feedback (insert only, anyone)         │
 │ errors + usage counts (every visit)│──►│                                         │
 │ feedback (only when sent)          │──►│                                         │
 └────────────────────────────────────┘   └───────────────┬─────────────────────────┘
                                                          │ pg_dump, encrypted
                                                          ▼
                                          Backup artifacts in private planner-ops (90 days)
```

Feedback is the one thing signed-out visitors can send. The database emails each message to the owner through Resend.

Read it top to bottom. **Source data** flows through review into static files. **User data** flows only between
the browser and Supabase. The two meet only in the browser.

## Two kinds of data, two homes

| | Source data | User data |
|---|---|---|
| What | Schools, open houses, key dates, neighborhoods, steps | A family's plan: home, priorities, saved schools, visits, steps, notes; where they left off |
| Who writes it | Us, by pull request | The family, in the app |
| Where | `data/*.json` in the repository, served with the site | The browser (`localStorage`), and Supabase when signed in |
| Public? | Yes | No: only the family's household (and the project owner) |
| Changes | About once a year per source ([data-sources.md](data-sources.md)) | Any time |
| Backed up by | Git history | [backups.md](backups.md) |

They're joined by **stable IDs** that never change: school DBN (`20K187`), event ID (`oh-20K187-2026-11-10-1730`,
`k-close`), step ID (`s3`), neighborhood ID (`dyker`). A plan stores only these IDs, so updating source data never
breaks a saved plan. The data checks block removing an ID that a plan might use.

## User data model

```
auth.users ──< household_members >── households ──< plans (household_id, cycle) ──< saved_schools (dbn, rank)
   │                                                                            ├──< visits (event_id, going, attended)
   │                                                                            ├──< step_progress (step_id)
   │                                                                            └──< school_notes (dbn, rating, pros, cons)
   ├── user_session (last_tab, last_dbn, last_view)
   ├──< events (name, props)          insert only, kept without the person if they delete their account
   └──< client_errors (message, …)    insert only, same
```

- **A household owns the plan**, so two parents can share one plan later without moving any data. Today each
  person gets their own household. Inviting a second parent is a planned feature that needs no schema change.
- **A person owns their session**, so each parent resumes where *they* left off.
- **`open_plan(cycle)` is the only way to create a household or plan.** It creates them the first time and returns
  the same plan after that.
- **`cycle`** (the fall entry year, `2027` now) is part of both the data and the plan, so next year's families get
  a new plan instead of last year's.
- Tables are normalized (one row per saved school, visit and so on), not one blob, so reports are plain SQL.
- The schema is in [supabase/migrations/](../supabase/migrations/); who can do what is in [security.md](security.md).

## On the device

| `localStorage` key | Holds |
|---|---|
| `d20plan` | The whole plan. Signed out, this is the only copy |
| `d20session` | Where the family left off on this device |
| `d20plan-unsynced` | "This device has changes the account doesn't have yet" |
| `d20plan-user` | Whose account this device last synced with |
| `d20plan-email` | The email of the account this device signed in to. Kept if the sign-in ends on its own, so the planner can say "You were signed out" and fill in the email; removed when the family signs out, deletes the account, or chooses "Not you?" |
| `sb-mhhszsyjxximewcuynis-auth-token` | The sign-in session (signed in only) |

## Sync (signed in)

The app is **local-first**: it always reads and writes the plan on the device, and syncs with the account in the
background. It works offline and never waits on the network to show a screen.

- **Signing in** loads the account's plan. If this device is new to the account, or has changes made offline, the
  two plans are **merged** (`mergePlans` in `src/plan-model.js`):
  - Settings: the account wins, unless they're still at their defaults.
  - Saved schools: the account's order first, then the device's new ones.
  - Visits and steps: everything from both.
  - Notes: the newer note wins, school by school.

  Otherwise the account's plan wins.
- **Saving:** 700 ms after a change, the app works out which rows changed (`diffRows`) and saves only those. One
  save runs at a time. If saving fails, the change stays on the device, is marked unsynced, and is sent when the
  device is back online.
- **Other devices** pick up changes when their tab comes back into view.
- **Where you left off** (`src/session.js`): the tab, view and open school are saved on the device straight away,
  and to `user_session` 1.5 seconds later or when the page is hidden. On another device, after signing in, the app
  opens there if that's newer and the family hasn't moved yet.
- **Usage events and errors** (`src/log.js`): sent in batches every few seconds, and only while signed in.

All of the plan logic (`toRows`, `fromRows`, `diffRows`, `mergePlans`) is pure functions with unit tests. The only
file that talks to Supabase is `src/sync/backend.js`, and signed-out visitors never load it.

## Delivery

- **No build step.** The files in the repository are the site: plain HTML, CSS and JavaScript modules. The
  Supabase library is vendored into `src/vendor/` and pinned by version and checksum.
- **Deploy:** merging to `main` publishes `index.html`, `privacy.html`, `src/`, `data/` and `fonts/` to GitHub Pages,
  at `d20.torilam.com`.
- **CI** runs on every pull request: lint, data checks (compared with the target branch), unit and database tests,
  and browser journeys on desktop, phone, and iPhone in Safari's engine ([testing.md](testing.md)).
- **Scheduled workflows:**
  - *Watch sources*: Mondays.
  - In the private `planner-ops` repository: *Backup* (daily Oct–Dec, Sundays and Wednesdays otherwise) and
    *Monitor* (hourly, plus the daily report). Private, because they handle families' data.
  - *New admissions cycle*: August 15.
  - *Refresh data*: run by hand.

  See [operations.md](operations.md).
- **Database changes** are SQL files in `supabase/migrations/`. Each is tested in CI against a real Postgres
  (PGlite), then pasted into the Supabase SQL Editor after merging.

## Design principles

1. **Two kinds of data, two homes.** Public source data is static and versioned. Private user data is behind
   sign-in.
2. **Local-first.** Signed out, the app works fully on one device. Signing in adds sync; it never takes anything away.
3. **Stable IDs.** User data refers to source data only by IDs that never change.
4. **Households own plans.** Sharing comes later without moving data.
5. **Anything expensive to retrofit was built in v1**, even in a minimal form: row-level security, households,
   the events table, account delete. Anything that only adds visibility, like dashboards, can come later.
6. **Every rule is tested:** match scores, data checks, merge rules, row-level security, and the journeys.

## Where the code is

See the file list in the [root README](../README.md#development). In short:
- `src/data.js`: source data, shaped for the views.
- `src/state.js` and `src/plan-model.js`: the plan.
- `src/account.js` and `src/sync/backend.js`: sign-in and sync.
- `src/session.js`: where the family left off.
- `src/log.js`: usage events and errors.
- `src/notices.js` and `src/feedback.js`: the pilot notice, the announcement banner, and Send feedback.
- `src/views/`: the screens.
- `scripts/`: data checks, refresh, source watch, and the live Supabase check.
