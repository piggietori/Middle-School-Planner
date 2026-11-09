# Data sources

Everything the planner shows about schools, open houses and dates comes from the sources below, kept in
`data/*.json`. Families' own plans are not here; they live in their browser or their account.

Every source changes about once a year, so each is pulled by a person about once a year. Where possible,
an automatic **watch** says when a source changed, so nobody has to remember to look.

## Summary

| Source | What we take from it | Kept in | Refresh cadence | How we know it's due |
|---|---|---|---|---|
| [NYC School Quality Reports](#nyc-school-quality-reports) | Test results (math, reading) | `data/schools.json` | Once a year, when the city publishes (spring) | Weekly watch |
| [District 20 open house flyer](#district-20-open-house-flyer) | Open house dates and times | `data/events.json` | Once a year (Sep–Oct), plus fixes through December | Weekly watch |
| [NYC middle school admissions](#nyc-middle-school-admissions) | Key dates: applications open, deadline, offers | `data/events.json` | Once a year | Weekly watch |
| [InsideSchools and the NYC School Survey](#insideschools-and-the-nyc-school-survey) | School facts, highlights and concerns, survey numbers | `data/schools.json` | Once a year (August) | August checklist |
| [Our own data](#our-own-data) | Neighborhoods, the step-by-step checklist | `data/neighborhoods.json`, `data/steps.json` | When we decide; steps reviewed each August | August checklist |

**How the reminders work**
- **Weekly watch:** every Monday the *Watch sources* workflow (`.github/workflows/watch-sources.yml`) checks
  the pages listed under `watch` for each source in `data/schools.json`, and the test results dataset's
  "last updated" date. For each source that changed it opens a GitHub issue that says what to update.
  Pages are compared by their visible text and the files they link to, so a redesign or tracking code
  doesn't count as a change. What each page looked like when we last updated from it is in `data/watch.json`.
- **August checklist:** on August 15 the *New admissions cycle* workflow opens one issue with everything to
  update for next year (`.github/new-cycle.md`).
- **Backstop:** the data checks (`npm run check:data`, run on every pull request) warn when open house dates
  haven't been checked for 30 days during application season, or school facts for more than 400 days.

## NYC School Quality Reports

- **What it is:** the city's yearly School Quality Reports, published on NYC Open Data as dataset
  [`dnpx-dfnc`](https://data.cityofnewyork.us/d/dnpx-dfnc). Source key: `nyc-sqr`.
- **What we take:** for each school, the percent of grade 6–8 students at level 3 or 4 on the state math
  and English tests (`math`, `ela`), weighted by how many students tested in each grade; and the same for
  the whole city (`city_averages`). Recorded in each school's `provenance.scores` with the school year (`period`).
- **Cadence:** once a year. The city publishes the previous school year's results in spring
  (2024-25 results were published April 9, 2026).
- **How to refresh:** when the watch opens its issue, run Actions → *Refresh data* → Run workflow
  (`scripts/refresh-data.js`). It opens a pull request with a table of every change. Fix any highlight text
  it flags as quoting an old number, merge, then accept the watch (below).
- **Now:** 2024-25 school year.

## District 20 open house flyer

- **What it is:** *District 20 Middle School Open House Dates*, a flyer the district office posts on the
  [District 20 website](https://sites.google.com/schools.nyc.gov/d20website). Source key: `d20-flyer-2026`
  (a new key each year, so past events keep pointing at the flyer they came from).
- **What we take:** each school's open house dates, start and end times, and notes such as "Virtual"
  (the `open` events in `data/events.json`).
- **Cadence:** the flyer comes out in September or October. Schools move or cancel open houses through
  December, so the watch matters most in that stretch.
- **Watched pages:** the D20 home page and its School Flyers page.
- **How to refresh:** compare the flyer with `data/events.json`. A moved open house keeps its `id` and gets
  `"was"` with the old date and time, so families who planned to go see that it moved. A cancelled one is
  removed and its `id` added to `retired_ids`. Update `as_of` on what you checked.

## NYC middle school admissions

- **What it is:** NYC Public Schools' middle school admissions page,
  [schools.nyc.gov/MS](https://www.schools.nyc.gov/MS). Source key: `nyc-ms-admissions`.
- **What we take:** the key dates (the `key` events in `data/events.json`): applications open (`k-open`),
  the District 20 middle school open house (`k-d20`), the application deadline (`k-close`) and offers (`k-offer`).
  The countdown, the steps, My list and the calendar all read these dates from the data.
- **Cadence:** once a year, with the new admissions cycle; rarely corrected mid-year.
- **Watched page:** the middle school enrollment page that schools.nyc.gov/MS leads to.
- **How to refresh:** compare the dates with the `key` events and update `as_of`.

## InsideSchools and the NYC School Survey

- **What it is:** [InsideSchools](https://insideschools.org) school profiles, and the NYC School Survey
  results they report (the survey itself is published as Excel files on
  [InfoHub](https://infohub.nyced.org), not on NYC Open Data). Source key: `insideschools`.
- **What we take:**
  - Survey numbers (`provenance.survey`): percent of students who feel safe (`safe`), who say bullying
    happens often (`bully`), and teachers who would recommend the school (`teach`), for each school and the city.
  - School facts (`provenance.profile`): name, address, grades, size, programs (`tags`), admissions method
    and its description, highlights (`good`), concerns, website, nearby subway and bus.
- **Cadence:** once a year, in August, from the checklist. There is no automatic pull or watch: InsideSchools
  has no data feed, and its highlights and concerns are written by people, so we read and summarize them.
- **How to refresh:** for each school, check the profile and the latest survey, update the fields and the
  `as_of` of `provenance.survey` and `provenance.profile`.

## Our own data

- **Neighborhoods** (`data/neighborhoods.json`): the neighborhoods families pick as home, each with an
  approximate center point used for straight-line distances. Changes only if we add neighborhoods.
- **Steps** (`data/steps.json`): the step-by-step checklist on Home. Reviewed each August against the city's
  current process. Step text can name a key date as `{k-close}`; the app fills in the date.

## Rules for every update

- Update `as_of` on everything you check, even if nothing changed.
- Never delete or rename an ID (school DBN, event `id`, neighborhood `id`, step `id`): saved plans point at them.
- After updating from a watched source, run `node scripts/watch-sources.js --accept <source key>` and commit
  `data/watch.json` in the same pull request, so the watch starts from what you just checked.
- Run `npm run check:data` before opening the pull request. Nothing reaches the site until it's merged.
