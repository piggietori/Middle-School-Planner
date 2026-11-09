# D20 Middle School Planner

A simple planner for families applying to middle school in Brooklyn's District 20 for fall 2027.

- **Home:** countdown to the December 11, 2026 application deadline, reminders, and a step-by-step checklist
- **Dates:** every District 20 open house and key admissions date, in a calendar or list, with "Add to my calendar" links
- **Find schools:** pick your neighborhood and what matters to you; schools are ranked with a match score and the reasons behind it
- **My list:** put your saved schools in order before entering them in MySchools

No sign-up. Choices are saved in your own browser on your device.

## Sources

- Open house dates and flyers: *District 20 Middle School Open House Dates 2026* (included in this repository)
- School facts, test results and survey data: [InsideSchools](https://insideschools.org) school profiles
- Admissions timeline: [schools.nyc.gov/MS](https://www.schools.nyc.gov/MS)

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
npm test           # unit tests (match score golden cases)
npm run test:e2e   # browser walk-throughs of the user journeys
```

- `index.html`: page markup
- `src/data.js`: schools, open houses, key dates, neighborhoods, steps
- `src/state.js`: the family's plan and where it is saved
- `src/match.js`: the match score (pure functions)
- `src/plan.js`: changes to the plan and progress worked out from it
- `src/views/`: one file per screen, plus the school sheet and notes
- `src/main.js`: clicks and form changes

CI runs lint and both test suites on every pull request. Pushes to `main` deploy to GitHub Pages (Settings → Pages → Source must be "GitHub Actions").
