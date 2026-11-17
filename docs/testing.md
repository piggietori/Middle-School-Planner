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
| Tag classifier eval (grading) | `tests/unit/tag-eval.test.js` | 8 | The eval's own scoring is right, with no model and no network: our answers score full marks and all-"no" doesn't, a quote must be in the source word for word, wrong yeses and wrong nos are counted apart, and the rules the classifier is given are the docs' rules word for word |
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

## Tag classifier eval

The whole picture, from stored evidence to what to do with a result: [evals.md](evals.md). This section is how to run it.

Music & band, arts and science & tech rest on written text (a review, a school's website), so a person judges
them. The classifier (`scripts/lib/tag-classifier.js`) makes that judgment repeatable: it reads a school's saved
source text and the written rules, and answers yes or no per tag with the words it rests on. It only proposes;
it never changes `data/schools.json`. The eval measures whether it can be trusted to.

- **Golden answers:** `tests/evals/tag-cases.json`, 48 decisions (16 schools × 3 tags). They are our own
  decisions, with a note on each judgment call.
- **Grading, all by code:** each answer against ours, reported per tag as precision, recall and specificity;
  every quote behind a "yes" must be in the school's source text word for word; and each school is run several
  times, so an answer that changes between runs is listed.
- **It runs on your machine, by hand.** Never in GitHub Actions: it needs an Anthropic API key, and the
  repository holds none ([secrets.md](secrets.md)). Each run costs one model call per school per run.

**The easy way: two files in the project folder, no terminal.**

- **`Run tag eval.cmd`**: double-click it. It refreshes each school's pages and re-checks every stored quote
  (free), tells you how many paid calls the run will make and asks before spending anything, runs the eval, and
  opens the results page in your browser. The first time, it asks for your Anthropic API key and saves it
  encrypted on this computer ([secrets.md](secrets.md)). If the rules, prompt, golden answers or runner changed
  since you last approved them, it lists what changed and asks you to approve before it runs. A run that stops
  part-way (closed window, out of credits) is picked up where it stopped the next time.
- **`View tag eval results.cmd`**: double-click to reopen the latest results page. Free; no key.
- **`Compare tag eval models.cmd`**: double-click to open the page that puts the models side by side. Free; no
  key. It needs a run from each model first.

**Two models.** The eval can ask Claude Opus 5.5 (Anthropic) or Muse Ember (Meta, `muse-ember-1.0`).
`Run tag eval.cmd` asks which one first. Both get the same prompt, rules, source text and grading. Meta's
Model API accepts Anthropic's request format at `https://api.meta.ai`, so the same classifier code serves both
([dev.meta.ai/docs/protocols/messages](https://dev.meta.ai/docs/protocols/messages)). Each model keeps its own
runs (`.claude/hillclimb/tag-classifier/` for Claude, `.claude/hillclimb/tag-classifier-muse-ember/` for Muse
Ember), its own run names and its own approval of the eval's files, and its own key ([secrets.md](secrets.md)).
A model's first run asks for approval, because nothing has been approved for its folder yet. After each run,
when both models have results, the comparison page opens too. It shows the per-tag scores, mistakes, answers
that changed between runs, time and tokens for each model, and every school and tag where the two answered
differently. It also estimates each run's cost, from the tokens each call reported and the list prices in
`scripts/lib/tag-prices.js`, with the date they were checked. Re-check them when a provider changes its prices.
Failed calls aren't counted. It lives at `.claude/hillclimb/compare.html` and is not committed. The models are listed in
`scripts/lib/tag-models.js` and, for the double-click file, `scripts/run-tag-eval.ps1`. A test checks that the
two lists agree.

**The results page** shows the per-tag table; a card for each answer that needs your decision, with the model's
quotes and reason beside our answer, note and stored evidence; what changed since the run before, both the
model's answers and ours; and every school's answers, with quotes and reasons to expand. It is rebuilt from
saved files each time and scored against today's golden answers, so after you change an answer, reopen it to
see the new score. It lives at `.claude/hillclimb/tag-classifier/<run>/report.html` and is not committed.

**The same by command**, if you prefer the terminal (in PowerShell use `npm.cmd`):

```
npm run fetch:tag-sources                 # save each school's source text to .cache/ (free; also re-checks every stored quote)
$env:ANTHROPIC_API_KEY = "..."            # your own key, in your shell only (PowerShell; bash: export ANTHROPIC_API_KEY=...)
npm run eval:tags -- --reps 3 --approve-harness   # first run, and after any change to the runner, rules, prompt or cases
npm run eval:tags -- --reps 3             # later runs; picks up where a stopped run left off
npm run eval:tags:summary                 # the per-tag table, answers that differ from ours, answers that flipped
npm run eval:tags:report                  # write the results page for the latest run and print where it is
$env:MODEL_API_KEY = "..."                # Muse Ember instead: your Meta Model API key, then
npm run eval:tags -- --flow .claude/hillclimb/tag-classifier-muse-ember --model muse-ember-1.0 --reps 3
npm run eval:tags:report -- --flow .claude/hillclimb/tag-classifier-muse-ember
npm run eval:tags:compare                 # the page comparing each model's latest run
npm run classify:tags                     # outside the eval: the classifier's answers next to today's tags
```

`--approve-harness` records that you have looked at the runner and what it runs; without it a changed runner
refuses to start. Each run has its own folder in `.claude/hillclimb/tag-classifier/`: `baseline` for the
first, then `v1`, `v2` and so on (`--variant v2`; the double-click file picks the next one). A folder holds
`results.jsonl`, one transcript per call in `traces/`, and failed calls in `errors.jsonl`: a failed call is
never scored as a wrong answer. `results.jsonl` can be committed to keep a run on record; transcripts and the
results page stay on your computer.

**When to run it:** when a tag rule, the classifier's prompt or the model changes, and each August with the
yearly tag review. Not weekly: the sources change about once a year.

**What it can and can't tell you:** 16 schools is a small set, so one answer is about 2 points and small
differences mean nothing. The golden answers are our decisions, so the eval measures agreement with us, not
truth. InsideSchools reviews date from 2017 to 2021. When the classifier and a tag disagree, read both quotes
and decide; a tag changes only with its evidence ([data-sources.md](data-sources.md#program-tags)).

## Not tested yet

- **Product evals:** does Next up surface the right thing, and does the match score help families choose? This
  needs real use: the daily report, pilot families' feedback, and talking to families.
- **Real Safari:** the journeys run in WebKit at iPhone size, which is close but not the same. Safari also clears a
  site's data after 7 days without a visit; the planner tells families when that signs them out. Try it on an iPhone
  before each release.
- **Load:** not needed at household scale.
- **Restore:** proven by the yearly restore drill ([backups.md](backups.md#the-restore-drill)), not by CI.
