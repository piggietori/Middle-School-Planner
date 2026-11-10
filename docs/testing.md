# Testing

What's tested, what each layer proves, and how to run it. Everything except the live check runs in CI on every
pull request, and the `main` ruleset doesn't allow merging until it passes.

## Layers

| Layer | Where | Tests | What it proves |
|---|---|---|---|
| Lint | `npm run lint` | — | No unused code, undefined names or common mistakes |
| Match score | `tests/unit/match.test.js` | 7 | Rankings for four fixed families match known-good results (golden cases), so a change to the score is always deliberate; schools without test results and far schools are scored and explained correctly |
| Plan sync | `tests/unit/plan-model.test.js` | 9 | Plans turn into database rows and back without loss; only changed rows are saved; merging two plans follows the rules |
| Data checks | `tests/unit/data.test.js` | 12 | Each kind of data mistake is caught (bad schema, broken references, removed IDs, impossible dates, stale text), on a frozen copy of the data so a refresh never breaks the tests. The live data has no errors |
| Source watch | `tests/unit/watch.test.js` | 4 | Page changes are detected; markup and tracking codes aren't mistaken for changes |
| Database security | `tests/db/rls.test.js` | 12 | Every migration runs in real Postgres (PGlite). Different people try to read and change each other's data, sign up for other households, and delete accounts; the database refuses what it should. Old events and errors are pruned, and only the database owner can prune |
| Data files | `npm run check:data` | — | The real `data/*.json` passes every check; compared with `main`, no ID was removed |
| Browser journeys | `tests/e2e/*.spec.js` | 27 scenarios × 2 (desktop and phone) | The journeys in [journeys.md](journeys.md), end to end in Chromium: first visit, sign-in and merge, a second device, offline saves, resume, Next up, after the deadline, sign-out choices, being signed out without choosing it, download, delete, logging, and that signed-out visitors contact no other site. Security: a note that looks like code is shown as text, and the Content-Security-Policy blocks inline scripts. An in-memory fake stands in for Supabase |
| Live check | `node scripts/check-supabase.js` | 16 checks | The real Supabase project, from outside: every table and function refuses signed-out visitors; email sign-in is on and anonymous sign-ins are off. Run by hand after database changes |

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
  needs real use, through the `events` table and talking to families.
- **Other browsers:** the journeys run in Chromium only. Safari on iPhone is the likeliest to differ; check it by
  hand before each release.
- **Load:** not needed at household scale.
- **Restore:** proven by the yearly restore drill ([backups.md](backups.md#the-restore-drill)), not by CI.
