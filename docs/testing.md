# Testing

What's tested, what each layer proves, and how to run it. Everything except the live check runs in CI on every
pull request, and the `main` ruleset doesn't allow merging until it passes.

## Layers

| Layer | Where | Tests | What it proves |
|---|---|---|---|
| Lint | `npm run lint` | — | No unused code, undefined names or common mistakes |
| Match score | `tests/unit/match.test.js` | 8 | Rankings for four fixed families match known-good results (golden cases), so a change to the score is always deliberate; schools without test results and far schools are scored and explained correctly; a card's number bullets are the same as the school sheet's |
| Number bullets | `tests/unit/facts.test.js` | 7 | A school's number highlights and concerns follow one rule for every school: 5 points from citywide either way, lower is better for bullying, large schools and no subway are flagged, and a missing number says nothing. Small school is worked out from size |
| Plan sync | `tests/unit/plan-model.test.js` | 9 | Plans turn into database rows and back without loss; only changed rows are saved; merging two plans follows the rules |
| Data checks | `tests/unit/data.test.js` | 17 | Each kind of data mistake is caught (bad schema, broken references, removed IDs, impossible dates, typed text that repeats a generated number bullet, a tag without evidence or one that disagrees with the school's program list), on a frozen copy of the data so a refresh never breaks the tests. The live data has no errors |
| Config | `tests/unit/config.test.js` | 1 | The help address and the Supabase region are filled in, so the privacy notice never shows a placeholder |
| Source pull | `tests/unit/insideschools.test.js` | 4 | Survey numbers, citywide averages, enrollment and the program list are read correctly from an InsideSchools profile; a missing answer is "no data"; a page that can't be read is an error, never "no data" |
| Tag rules | `tests/unit/tag-rules.test.js` | 4 | Honors, dual language and special-ed follow a school's program list by one rule: a screened program, a dual language program, a specialized program or the staff pick; nothing else earns them |
| Source watch | `tests/unit/watch.test.js` | 4 | Page changes are detected; markup and tracking codes aren't mistaken for changes |
| Database security | `tests/db/rls.test.js` | 16 | Every migration runs in real Postgres (PGlite). Different people try to read and change each other's data, sign up for other households, and delete accounts; the database refuses what it should. Old events and errors are pruned, and only the database owner can prune. Anyone can send feedback, but nobody can read or change it, or mark it emailed |
| Data files | `npm run check:data` | — | The real `data/*.json` passes every check; compared with `main`, no ID was removed |
| Browser journeys | `tests/e2e/*.spec.js` | 42 scenarios × 3 (desktop, phone, and iPhone in WebKit, Safari's engine) | The journeys in [journeys.md](journeys.md), end to end in Chromium and WebKit: first visit, sign-in and merge, a second device, offline saves, resume, Next up, after the deadline, sign-out choices, being signed out without choosing it, download, delete, logging, and that signed-out visitors contact no other site. Launch: the pilot notice, the banner, invite-only sign-in, the
privacy page, and feedback (sent without the account, and kept if sending fails). Accessibility: axe finds no serious
or critical problems on any tab, sheet or the privacy page. Anything the CSP blocks is reported when signed in. Security: a note that looks like code is shown as text, and the Content-Security-Policy blocks inline scripts. An in-memory fake stands in for Supabase |
| Live site in real browsers | `node scripts/smoke-live.js <url>` | 1 visit × 2 browsers | The live site works for a signed-out visitor in Chromium and in WebKit at iPhone size: it loads with no errors, shows Dates, and opens a school. The monitor runs it every 3 hours ([failure-modes.md](failure-modes.md)) |
| Live check | `node scripts/check-supabase.js` | 17 checks | The real Supabase project, from outside: every table and function refuses signed-out visitors; email sign-in is on and anonymous sign-ins are off. Run by hand after database changes, and hourly by the monitor |

## Running them

```
npm run lint
npm run check:data            # add -- --base origin/main to also catch removed IDs
npm test                      # unit and database tests (about 10 seconds)
npm run test:e2e              # browser journeys (about 30 seconds; starts its own server on port 5174)
node scripts/check-supabase.js
```

CI (`.github/workflows/ci.yml`) runs everything above except the live check, on every pull request (with the data checks
compared against the pull request's base branch).

## Data evals

The data checks double as evals for the source data: they run on every pull request that touches `data/`, and the
*Refresh data* workflow runs them on its own changes and puts the results in its pull request.
[data-sources.md](data-sources.md#what-the-data-checks-catch) lists what they catch.

## Not tested yet

- **Product evals:** does Next up surface the right thing, and does the match score help families choose? This
  needs real use: the daily report, pilot families' feedback, and talking to families.
- **Real Safari:** the journeys run in WebKit at iPhone size, which is close but not the same. Safari also clears a
  site's data after 7 days without a visit; the planner tells families when that signs them out. Try it on an iPhone
  before each release.
- **Load:** not needed at household scale.
- **Restore:** proven by the yearly restore drill ([backups.md](backups.md#the-restore-drill)), not by CI.
