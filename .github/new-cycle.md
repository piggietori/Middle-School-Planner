Once a year, before open house season, update the sources that have no automatic pull. Do it in one
pull request, update `as_of` on everything you checked, and run `npm run check:data` before opening it.
See README → Updating data.

**Admissions year**
- [ ] Set `cycle` to the new fall entry year in `data/schools.json`, `data/events.json` and `data/steps.json`. Families get a fresh plan for the new cycle; last year's stays in their account.
- [ ] Key dates from [schools.nyc.gov/MS](https://www.schools.nyc.gov/MS): applications open, D20 events, deadline, offers (`k-*` in `data/events.json`). The countdown, steps, My list and the calendar's months all read them from there; step text names them as `{k-close}`.

**Open houses** (D20 flyer, usually out in September or October)
- [ ] Add the new flyer to `sources` in `data/schools.json` under a new key (for example `d20-flyer-2027`) and point its `watch` at the D20 pages. Keep the old key: past events refer to it.
- [ ] Add the new open houses to `data/events.json`. Put last year's open house IDs in `retired_ids` and remove them.

**Schools** ([InsideSchools](https://insideschools.org) and the NYC School Survey on [InfoHub](https://infohub.nyced.org))
- [ ] For each school: size, programs, admissions method, highlights and concerns. Update `provenance.profile`.
- [ ] Survey numbers (feels safe, bullying, teachers) and school size are pulled every Monday by *Refresh data*. Check it has run (Actions → Refresh data) and that no pull request from it is waiting.
- [ ] Re-read every highlight and concern that quotes a number we don't hold (attendance, suspensions, class size): the data checks can't.
- [ ] Any new District 20 middle schools (and their neighborhoods' distances).

**Test results**
- [ ] If NYC published new results since the last refresh: Actions → Refresh data → Run workflow. (The weekly watch opens an issue when they do.)

**Steps**
- [ ] Read `data/steps.json` against the city's current process and fix anything that changed.

**Safety**
- [ ] Restore drill: open the latest backup with the passphrase ([docs/secrets.md](../docs/secrets.md#restore-drill-once-then-every-august)).
- [ ] 2FA is still on for the Supabase and GitHub accounts, and the `main` ruleset is still active (Settings → Rules).

**Finish**
- [ ] `node scripts/watch-sources.js --accept` and commit `data/watch.json`, so the weekly watch starts from what you just checked.
