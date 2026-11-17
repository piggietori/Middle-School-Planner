// Write the page that compares the models' tag eval runs side by side, and print where it is. Built only from
// saved files, so it is free and needs no key. "Compare tag eval models.cmd" in the project folder calls this.
// Usage: node scripts/eval-tags-compare.js   each model's latest run with results (scripts/lib/tag-models.js)
import fs from "node:fs";
import path from "node:path";
import {listRuns} from "./lib/tag-runs.js";
import {MODELS} from "./lib/tag-models.js";
import {PRICES} from "./lib/tag-prices.js";
import {buildComparison} from "./lib/tag-compare.js";

const root = path.resolve(import.meta.dirname, "..");
const cases = JSON.parse(fs.readFileSync(path.join(root, "tests/evals/tag-cases.json"), "utf8")).cases;
const runs = [], none = [];
for (const [model, m] of Object.entries(MODELS)) {
  const last = listRuns(m.flow).filter(r => r.rows.length).at(-1);
  if (last) runs.push({...last, model, label: m.label, flow: m.flow, price: PRICES[model]}); else none.push(m.label);
}
if (runs.length < 2) {
  console.error(`Nothing to compare yet: no results for ${none.join(" or ")}. Run the eval with each model first (docs/testing.md).`);
  process.exit(2);
}
const newest = Math.max(...runs.map(r => fs.statSync(path.join(r.flow, r.variant, "results.jsonl")).mtimeMs));
const generated = `Latest run finished ${new Date(newest).toLocaleString("en-US", {dateStyle: "long", timeStyle: "short"})}`;
const out = path.join(".claude/hillclimb", "compare.html");
fs.writeFileSync(out, buildComparison({runs, cases, generated}));
console.log(path.resolve(out));
