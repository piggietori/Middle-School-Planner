# Agents: which jobs are worth handing to a model

The planner already runs itself without AI: *Monitor*, *Backup*, *Watch sources*, *Refresh data*, *New admissions
cycle*, *Release*, the database clock and the daily report ([operations.md](operations.md)). Every one of them ends at
a person. This page records an audit (2026-11-17) of what the owner still does by hand, again and again, that needs
reading and judgment, and whether an agent would do it cheaply and safely enough to be worth owning.

**Decision:** build nothing this season. In August 2027, build the *source-change drafter* (below), shadow mode
first. The August checklist ([.github/new-cycle.md](../.github/new-cycle.md)) brings the decision back.

## What the numbers rest on

- *Watch sources* opened 6 "Source changed" issues in 6 days (#30 to #52, November 12–17, 2026). At least one (#51)
  was closed "no change". Each issue means opening the flyer or page, comparing it with `data/events.json`, editing,
  running `node scripts/watch-sources.js --accept <key>`, and opening a pull request: about 15–30 minutes, mostly in
  October to December, the busiest stretch of the year.
- Price: Claude Opus 5.5 at $4 per million input tokens and $20 per million output
  ([scripts/lib/tag-prices.js](../scripts/lib/tag-prices.js), checked 2026-11-17). A flyer plus `events.json` is
  about 25,000 tokens in and 3,000 out: about **$0.16 a call**.
- The pieces already exist: a model client and structured answers (`scripts/lib/tag-classifier.js`), an eval harness
  (`scripts/eval-tags.mjs`), a cost calculator (`costOf` in `scripts/lib/tag-prices.js`) and a quote check
  (`quoteFound` in `scripts/lib/tag-sources.js`).

## The candidates

| # | Job | Toil today | Value of an agent | Running cost | Upkeep | Verdict |
|---|---|---|---|---|---|---|
| 1 | **Source-change drafter**: when *Watch sources* opens an issue, read the changed flyer or page, compare it with `events.json`, then either say "no change, safe to accept" or propose the moved, new and cancelled open houses | About 6 a week in season, 15–30 min each; 25–40 a year | High: about 5–10 hours saved a season, and moved open houses caught sooner (F-31: a wrong date sends a family to a closed door) | $0.20–0.50 an issue, **under $15 a year** | Medium (see below) | **Build, August 2027** |
| 2 | Monday refresh fixer: when the *Refresh data* pull request flags text that no longer matches the numbers, propose the new wording | Weekly, 5–15 min, often nothing to fix | Medium-low | About $0.10 a week | Low, if it reuses #1's plumbing | Later, after #1 |
| 3 | Feedback triage: sort feedback into wrong fact, bug or question, and draft replies | Low volume in the pilot | Low for now | Pennies | **High privacy cost**: families' messages and email addresses would go to a model provider, against [privacy.md](privacy.md) | Don't build. Revisit only above about 5 messages a day, and only after the privacy notice says so |
| 4 | Alert and daily-report summarizer | Each alert already says what to do; the report is short | Low | Pennies | One more thing to trust in the middle of an incident | Don't build |
| 5 | Playwright image tag (in `ci.yml` and `planner-ops` `monitor.yml`) when Dependabot bumps `@playwright/test` | A few times a year | Low | — | — | **Not an agent**: a CI check that fails when the tag and the package version differ is exact and free |
| 6 | The August new-cycle checklist | Once a year, about a day | Medium | — | A standing agent for a yearly job | **Not an agent**: work through it in a Claude Code session |

Only #1 clears the bar. It is the one job that is frequent, mostly reading, busiest exactly when the owner has least
time, and already ends in a pull request with data checks. So a wrong draft is caught before families see it.

## What owning an agent costs, beyond the model calls

- **A key.** `ANTHROPIC_API_KEY` as an Actions secret in the public repository, with a monthly spend limit on the
  Anthropic console (for example $10). Add it to [secrets.md](secrets.md).
- **Outside text.** The flyer and school pages are written by others and could contain instructions. The agent gets
  read access to the repository and permission to comment on issues, nothing else: it can't merge, push to `main`,
  or reach Supabase or `planner-ops`. The `main` ruleset, CI and the owner's review stay the gate.
- **An eval before it is trusted.** A small golden set from past changes (#30, #36, #39, #47, #51, #52 and the
  pull requests that followed them), checked the way the tag eval is ([evals.md](evals.md)), and run again whenever
  the model or the prompt changes.
- **Models retire and prices change.** Once a year: check `tag-prices.js` and run the eval again.
- **Docs.** A row in [failure-modes.md](failure-modes.md) ("the drafter proposes a wrong date": caught by the data
  checks and the owner's review), a line in [operations.md](operations.md), and a note in
  [governance.md](governance.md) that the backup person can ignore its comments.
- **The owner's time.** About 2 hours to set it up with its eval, then about an hour a year. It pays for itself in
  its first season.

## Why not this season

On 2026-11-17 about 3½ weeks were left before the December 11 deadline: 10–15 issues at most. That's too few to
earn back the setup and the eval, and too late to trust a new tool in the busiest weeks.

## If we build it

**Shadow mode first (August to December 2027).** It comments a proposal on the issue and never opens a pull request.

- `scripts/draft-source-change.js`: given the source key from the issue, fetch the page the way
  `scripts/watch-sources.js` does, load `data/events.json` and the rules in [data-sources.md](data-sources.md) (a moved
  open house keeps its `id` and gets `was`; a cancelled one goes in `retired_ids`; update `as_of`), and ask the model
  for a structured answer: `{changed, edits, quotes}`. Every quote must be found word for word in the fetched text
  (`quoteFound`), or the proposal is dropped.
- `.github/workflows/watch-sources.yml`: after the issues open, run the drafter for each new one and post its
  proposal, with its cost, as a comment. Mark the step `continue-on-error`, so *Watch sources* never fails because of
  the agent and still works with the key removed.
- The golden set and its check in `tests/`, the docs above, and a CHANGELOG line.

**Then, once its proposals have matched the owner's own fixes for a season:** let it open draft pull requests, the
way *Refresh data* does (`peter-evans/create-pull-request`). The owner still reviews and merges each one.
