// Write the tag classifier eval's results page for one run and print where it is. Built only from saved
// files, so it is free and needs no key. The double-click files in the project folder call this.
// Usage: node scripts/eval-tags-report.js [--flow .claude/hillclimb/tag-classifier] [--variant v1] [--prev baseline]
//        node scripts/eval-tags-report.js --next-run [--reps 3]   print which run a new eval would write to, as JSON
import fs from "node:fs";
import path from "node:path";
import {listRuns, nextRun, readJsonl, usage} from "./lib/tag-runs.js";
import {buildReport} from "./lib/tag-report.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const root = path.resolve(import.meta.dirname, "..");
const flow = arg("--flow", ".claude/hillclimb/tag-classifier");
const cases = JSON.parse(fs.readFileSync(path.join(root, "tests/evals/tag-cases.json"), "utf8")).cases;
const runs = listRuns(flow);
const scored = runs.filter(r => r.rows.length);

if (process.argv.includes("--next-run")) {
  const reps = +arg("--reps", 3), last = scored.at(-1);
  console.log(JSON.stringify({...nextRun(runs, cases.length * reps), total: cases.length * reps, last: last ? {variant: last.variant, ...usage(last.rows)} : null}));
  process.exit(0);
}

const variant = arg("--variant", scored.at(-1)?.variant);
const run = scored.find(r => r.variant === variant);
if (!run) { console.error(variant ? `No results for ${variant} in ${flow}.` : `No results in ${flow} yet. Run the eval first (docs/testing.md).`); process.exit(2); }
const before = scored.slice(0, scored.indexOf(run)).at(-1);
const prev = scored.find(r => r.variant === arg("--prev", before?.variant)) ?? null;

const dir = path.join(flow, variant);
// Each trace is the conversation for one call; its last message is the classifier's answer as JSON.
const traces = {};
for (const r of run.rows) {
  try {
    const t = JSON.parse(fs.readFileSync(path.join(dir, "traces", `${r.prompt_id}_rep${r.rep}.json`), "utf8"));
    traces[`${r.prompt_id}_rep${r.rep}`] = JSON.parse(t.at(-1).content);
  } catch { /* not saved on this computer: the page says so */ }
}
const schools = JSON.parse(fs.readFileSync(path.join(root, "data/schools.json"), "utf8")).schools;
const generated = `Run finished ${fs.statSync(path.join(dir, "results.jsonl")).mtime.toLocaleString("en-US", {dateStyle: "long", timeStyle: "short"})}`;
const out = path.join(dir, "report.html");
fs.writeFileSync(out, buildReport({variant, rows: run.rows, errors: readJsonl(path.join(dir, "errors.jsonl")), traces, cases, schools, prev, generated}));
console.log(path.resolve(out));
