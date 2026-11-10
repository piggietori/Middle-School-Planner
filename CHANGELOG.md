# Changelog

What changed in each version of the D20 Middle School Planner, newest first. Each version's section becomes its
GitHub Release notes when it's tagged (see [docs/operations.md](docs/operations.md#making-changes)).

Versions follow [semantic versioning](https://semver.org): a fix bumps the last number (1.1.0 → 1.1.1), a new
feature the middle one (1.1 → 1.2), and a change that needs families or the database to move over the first.

## [Unreleased]

## [1.2.0] - 2026-11-11

Ready for other families, starting with a small pilot.

### Added
- **It says it's a pilot.** A "Pilot" tag next to the title, and a notice on Home: the planner is made by a District 20
  parent, not by NYC Public Schools, so confirm dates with the schools. Dismiss it once per device.
- **My list says where the application really happens:** "This list is for planning. Your application counts only
  when you submit it in MySchools."
- **Privacy and terms,** in plain language, linked from the bottom of every page and from the sign-in screen.
- **Send feedback,** at the bottom of every page. It goes straight to the parent who runs the planner, isn't linked to
  your account, and you choose whether to leave an email for a reply. If it can't be sent, your message is kept.
- **Announcements:** a banner on every tab when something changes, such as an open house that moved.
- **Invite-only sign-in during the pilot.** An address that wasn't invited is told so, instead of seeing an error.
- **Sign-in emails come from the planner's own address,** so they arrive faster and stay out of spam.
- **The changelog** (this file). CI checks that every version has its notes, and tagging a version publishes them as
  the GitHub Release.

### Changed
- **On a school's page, "Our notes" is now at the end,** after the school's details and sources.
- **Easier to read:** darker orange and amber text, and calendar days that read properly with a screen reader.

### Security
- **Backups moved to a private repository,** so only the owner can download them, and the public repository holds no
  secrets.
- **Hourly monitoring:** the site, Supabase, security settings, errors, failed saves, backups and capacity are checked
  every hour. Problems open an alert that emails the owner, and a daily report shows how the planner is used (counts only).
- **Dependabot** proposes updates to the tools and workflows each week.
- **Tested on iPhone (Safari's engine) and for accessibility** on every pull request.

## [1.1.1] - 2026-11-10

### Fixed
- **Being signed out without choosing it is now explained.** If the sign-in ends on its own, the planner says
  "Signed out on this device: your plan is still here". It no longer claims the plan is "only on this device". The
  sign-in screen says "Sign in again", with the email filled in. "Not you? Forget this email" is there for shared
  computers.
- **A blank start points to the account.** When a browser has lost the site's data, "Start here" adds "Already made a
  plan? Sign in to get it back."

## [1.1.0] - 2026-11-10

### Security
- **A Content-Security-Policy:** only the site's own scripts can run, and the page can contact only Supabase.
  Injected scripts are blocked.
- **Fonts are served from the site,** so visitors' browsers no longer contact Google.
- **`main` is protected:** changes arrive only through pull requests that pass CI.

### Changed
- **Error reports are deleted after 90 days, and usage events after 1 year,** by a nightly job in the database.
- **Backups outside application season run twice a week** (Sundays and Wednesdays), so the free Supabase project
  never goes a week without activity.

### Added
- **Docs on how the planner works:** architecture, data refresh, backups, security, privacy, operations and
  testing ([docs/](docs/README.md)).

## [1.0.0] - 2026-11-10

### Added
- **Data you can trust:**
  - School, open house and admissions data lives in `data/*.json`, and every record says where it came from and when.
  - The app shows when the data was last updated.
  - Test results are for the 2024-25 school year.
  - A weekly watch opens an issue when a source changes, and an August checklist covers the yearly update.
  - Data checks run on every change.
- **Your plan on every device (optional):**
  - Sign in with an emailed link, no password.
  - Schools, visits, steps and notes stay the same on every device.
  - Signing in on a device that already has a plan combines the two.
- **Picks up where you left off:**
  - It opens on the same tab, view and school, on any device.
  - A **Next up** card on Home shows what to do now.
  - After the deadline, My list shows the list you submitted.
- **Your data, your choice:**
  - Download all your data, or delete your account.
  - Signing out asks whether to keep a copy on this device.
- **Error reports and a few usage events** (IDs only), recorded only while signed in.

### Changed
- **The single HTML file was split into modules,** with unit, database security and browser tests on every pull
  request.
- **Supabase for accounts,** with row-level security on every table.
- **Encrypted backups** of the account data.

## [0.1.0] - 2026-11-09

The MVP: one HTML file, no sign-up, choices saved in the browser.

### Added
- **Home:** a countdown to the December 11, 2026 deadline, reminders, and a step-by-step checklist.
- **Dates:** every District 20 open house and key admissions date, as a calendar or a list, with "Add to my
  calendar" links.
- **Find schools:** pick your neighborhood and priorities; schools are ranked with a match score and its reasons.
- **My list:** put saved schools in order, with a "Ready for MySchools" guide showing school codes.
- **Notes and compare:** your rating, likes and concerns for each school, and a side-by-side compare view.

[Unreleased]: https://github.com/piggietori/Middle-School-Planner/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/piggietori/Middle-School-Planner/releases/tag/v1.2.0
[1.1.1]: https://github.com/piggietori/Middle-School-Planner/releases/tag/v1.1.1
[1.1.0]: https://github.com/piggietori/Middle-School-Planner/releases/tag/v1.1.0
[1.0.0]: https://github.com/piggietori/Middle-School-Planner/releases/tag/v1.0.0
[0.1.0]: https://github.com/piggietori/Middle-School-Planner/releases/tag/v0.1.0
