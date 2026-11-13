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
| [InsideSchools and the NYC School Survey](#insideschools-and-the-nyc-school-survey) | Survey numbers and school size | `data/schools.json` | Pulled every Monday | *Refresh data* opens a pull request |
| Same | School facts, highlights and concerns | `data/schools.json` | Once a year (August) | August checklist |
| [Our own data](#our-own-data) | Neighborhoods, the step-by-step checklist, the announcement banner | `data/neighborhoods.json`, `data/steps.json`, `data/notice.json` | When we decide; steps reviewed each August | August checklist |

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
- **Numbers, pulled automatically:** every Monday the *Refresh data* workflow reads each school's profile page
  (`insideschools.org/school/<DBN>`, read by `scripts/lib/insideschools.js`) and takes the three survey
  numbers, their citywide averages and enrollment (`size`). If anything differs from our data it opens a pull
  request with a table of every change. A number the page doesn't show is never blanked: ours is kept and the
  pull request says so. If a page can't be read (InsideSchools changed its layout), the pull request or the
  failed run says which, and nothing is guessed.
- **One citywide average:** InsideSchools compares K–8 and 6–12 schools with a slightly different citywide
  figure. We show one for every school: the one most of our schools are compared with (the 6–8 figure).
- **Everything else, by hand:** once a year, in August, from the checklist. Highlights and concerns are written
  by people, so we read and summarize them. For each school, check the profile, update the fields and the
  `as_of` of `provenance.profile`.
- **Number bullets are generated, not written.** On a school's sheet, Highlights and Reported concerns show the
  hand-written bullets first, then bullets worked out from the numbers by `src/facts.js`, with one rule and one
  wording for every school:
  - test results (math and reading together), feel safe, bullying and teachers recommend: a highlight when 5 or
    more points better than citywide, a concern when 5 or more points worse, nothing in between;
  - 1,150 students or more: "Large school"; no subway stop: "No subway nearby".

  The Find cards show the same highlights, in the same words, after the family's own reasons (distance,
  programs they picked, subway).

  So **don't write a highlight or concern about those numbers** (or about size or the subway): it would show
  twice, or give one school a bullet that others with the same number don't get. The data checks warn if you do.
  Write what numbers can't say: programs, facilities, leadership, what students and teachers report.
- **Numbers we don't hold** (attendance, suspensions, class size, graduation rate) can be written, and can't be
  checked; re-read those in August.

## Our own data

- **Neighborhoods** (`data/neighborhoods.json`): the neighborhoods families pick as home, each with an
  approximate center point used for straight-line distances. Changes only if we add neighborhoods.
- **Steps** (`data/steps.json`): the step-by-step checklist on Home. Reviewed each August against the city's
  current process. Step text can name a key date as `{k-close}`; the app fills in the date.
- **Announcement banner** (`data/notice.json`): `null`, or one message shown on every tab until its `until` date.
  How to post one: [operations.md](operations.md#the-banner). The data checks warn once its date has passed.

## How a change reaches the site

1. **Something says it's due:** a *Watch sources* issue (a page or dataset changed), the August checklist
   (*New admissions cycle*), or a family reporting a wrong date.
2. **The change is made:** a person edits `data/*.json` by hand; or *Refresh data* (every Monday, or run by
   hand) pulls test results, survey numbers and school size and opens a pull request itself.
3. **The data checks run** (`npm run check:data`, and again in CI), comparing with `main` so removed IDs are caught.
4. **Someone reviews the pull request.** The diff shows exactly which dates and numbers changed.
5. **Merging to `main` deploys it** to GitHub Pages within a minute or two.
6. **Families see it** the next time they open the planner: "last updated" dates change, and a moved open house
   shows what it was before (`was`), so families who planned to go notice.

Nothing changes on the site without a merged pull request, so every change has a record and can be reverted.

## What the data checks catch

`scripts/lib/data-checks.js`, tested in `tests/unit/data.test.js`. Errors block the pull request; warnings are
shown for a person to judge.

| Check | Level |
|---|---|
| A file doesn't match its schema (`data/schema/`) | Error |
| Duplicate DBN, event, neighborhood or step ID | Error |
| `events.json` or `steps.json` is for a different `cycle` from `schools.json` | Error |
| A reference points nowhere: a program tag, a source, an open house's school | Error |
| An event ends before it starts, or falls outside the admissions cycle | Error |
| `was` is the same as the current date and time | Error |
| A retired event ID is still listed | Error |
| A key date the app needs is missing (`k-close`, `k-offer`), or a step names a `{k-…}` that doesn't exist | Error |
| A school, event, neighborhood or step was removed compared with `main` (saved plans point at them) | Error |
| An event's date or time changed without `was` | Warning |
| A score moved by 15 points or more | Warning |
| A typed highlight or concern repeats what the sheet shows by rule (test results, feel safe, bullying, teachers recommend, school size, no subway), or says "too new for full test results" when results exist | Warning |
| An event not checked for 30 days during application season | Warning |
| A school fact not checked for over 400 days | Warning |

## Rules for every update

- Update `as_of` on everything you check, even if nothing changed.
- Never delete or rename an ID (school DBN, event `id`, neighborhood `id`, step `id`): saved plans point at them.
- After updating from a watched source, run `node scripts/watch-sources.js --accept <source key>` and commit
  `data/watch.json` in the same pull request, so the watch starts from what you just checked.
- Run `npm run check:data` before opening the pull request. Nothing reaches the site until it's merged.
