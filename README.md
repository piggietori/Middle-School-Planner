# D20 Middle School Planner

A simple planner for families applying to middle school in Brooklyn's District 20 for fall 2027.

- **Home:** countdown to the December 11, 2026 application deadline, reminders, and a step-by-step checklist
- **Dates:** every District 20 open house and key admissions date, in a calendar or list, with "Add to my calendar" links
- **Find schools:** pick your neighborhood and what matters to you; schools are ranked with a match score and the reasons behind it
- **My list:** put your saved schools in order before entering them in MySchools

No sign-up. Choices are saved in your own browser on your device.

## Sources

- Open house dates and flyers: *District 20 Middle School Open House Dates 2026* (included in this repository)
- Test results: [NYC School Quality Reports](https://data.cityofnewyork.us/d/dnpx-dfnc) on NYC Open Data, pulled by a workflow when the city publishes new results
- School facts and survey data: [InsideSchools](https://insideschools.org) school profiles
- Admissions timeline: [schools.nyc.gov/MS](https://www.schools.nyc.gov/MS)

Every record in `data/` says where it came from and when (`source`, `as_of`), and the app shows when the data was last updated. Details and refresh cadence: [docs/data-sources.md](docs/data-sources.md).

This is an independent tool, not an official NYC Public Schools site. Confirm dates and details with each school.

## Versions

- **MVP** (`v0.1.0`, tag `mvp`): the original single-file planner. [Release](https://github.com/piggietori/Middle-School-Planner/releases/tag/v0.1.0)
- **v1** (in progress on the `v1` branch): data that stays up to date, accounts, and picking up where you left off. See [docs/journeys.md](docs/journeys.md).

## Development

Plain HTML, CSS and JavaScript modules. There is no build step: the files in the repo are the site.

```
npm install
npm run dev        # http://localhost:5173
npm run lint
npm run check:data # data checks (add -- --base origin/v1 to also catch removed IDs)
npm test           # unit tests: match score golden cases and data checks
npm run test:e2e   # browser walk-throughs of the user journeys
npm run refresh:data # pull the latest test results into data/schools.json
```

- `index.html`: page markup
- `data/*.json`: schools, open houses and key dates, neighborhoods, steps; `data/schema/` describes each file
- `src/data.js`: loads the data files for the views
- `src/state.js`: the family's plan and where it is saved
- `src/match.js`: the match score (pure functions)
- `src/plan.js`: changes to the plan and progress worked out from it
- `src/views/`: one file per screen, plus the school sheet and notes
- `src/main.js` loads `src/app.js`, which handles clicks and form changes
- `scripts/`: dev server, data checks, data refresh, source watch

### Updating data

Every source changes about once a year, so each one is pulled once a year by a person. Where we can, a watch tells you when that's due. **[docs/data-sources.md](docs/data-sources.md)** lists each source, what we take from it, its refresh cadence and how to update it.

- **Watched** (`"watch"` on the source in `data/schools.json`): every Monday the *Watch sources* workflow checks those pages, and the dataset's last-updated date, and opens an issue for each source that changed, saying what to do. After updating our data, run `node scripts/watch-sources.js --accept <source>` and commit `data/watch.json` in the same pull request.
- **August checklist**: on August 15 the *New admissions cycle* workflow opens an issue with everything to update for next year ([.github/new-cycle.md](.github/new-cycle.md)).
- The *Refresh data* workflow pulls test results and opens a pull request with a table of what changed. Fix any warnings it lists (usually highlight text that quotes an old number), then merge.
- Update `as_of` on everything you check by hand.
- **Never delete or rename an ID** (school DBN, event `id`, neighborhood `id`, step `id`): saved plans point at them. If an open house moves, change its date or time, keep its `id`, and add `"was": {"date": ..., "start": ...}` so families see it moved. If one is cancelled, remove it and add its ID to `retired_ids`.

CI runs lint, the data checks and both test suites on every pull request. Pushes to `main` deploy to GitHub Pages (Settings → Pages → Source must be "GitHub Actions"). The refresh workflow needs Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests".
