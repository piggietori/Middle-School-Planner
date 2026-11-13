// Print the tag classifier eval's results per tag: precision, recall, specificity, the answers that
// differ from ours, and the answers that flipped between runs. Reads what scripts/eval-tags.mjs wrote.
// Usage: node scripts/eval-tags-summary.js [--flow .claude/hillclimb/tag-classifier] [--variant baseline]
import fs from "node:fs";
import path from "node:path";
import {summarize} from "./lib/tag-eval.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const dir = path.join(arg("--flow", ".claude/hillclimb/tag-classifier"), arg("--variant", "baseline"));
const lines = f => fs.existsSync(f) ? fs.readFileSync(f, "utf8").split("\n").filter(l => l.trim()).map(l => JSON.parse(l)) : [];
const rows = lines(path.join(dir, "results.jsonl")), errors = lines(path.join(dir, "errors.jsonl"));
if (!rows.length) { console.error(`No results in ${dir}. Run the eval first (docs/testing.md).`); process.exit(2); }

const all = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../tests/evals/tag-cases.json"), "utf8")).cases;
const cases = all.filter(c => rows.some(r => r.prompt_id === c.id));
const name = id => all.find(c => c.id === id).school;
const {tags, flips, misses, runs} = summarize(rows, cases);
const pct = v => v == null ? "n/a" : Math.round(v * 100) + "%";
const LABEL = {music: "Music & band", arts: "Arts", stem: "Science & tech"};

console.log(`${cases.length} schools, ${runs} runs, model ${[...new Set(rows.map(r => r.model))].join(", ")}\n`);
console.log("| Tag | Right | Precision | Recall | Specificity | Wrong yes | Wrong no |\n|---|---|---|---|---|---|---|");
for (const [t, m] of Object.entries(tags)) console.log(`| ${LABEL[t]} | ${pct(m.accuracy)} | ${pct(m.precision)} | ${pct(m.recall)} | ${pct(m.specificity)} | ${m.fp} | ${m.fn} |`);
const quotes = rows.filter(r => r.grade.quotes_ok !== 1);
console.log(`\nQuotes not found word for word in the source: ${quotes.length ? "" : "none"}`);
for (const r of quotes) console.log(`- ${name(r.prompt_id)} (run ${r.rep + 1}): ${r.explanation.quotes_ok}`);
console.log(`\nSame answer every run, but not ours: ${misses.length ? "" : "none"}`);
for (const m of misses) console.log(`- ${name(m.id)}, ${LABEL[m.tag]}: model says ${m.said ? "yes" : "no"}, ours is ${m.ours ? "yes" : "no"}`);
console.log(`\nAnswer changed between runs: ${flips.length ? "" : "none"}`);
for (const f of flips) console.log(`- ${name(f.id)}, ${LABEL[f.tag]}: yes in ${f.yes} of ${f.runs} runs`);
if (errors.length) console.log(`\n${errors.length} failed attempt(s) are in ${path.join(dir, "errors.jsonl")} and are not counted above.`);
const usage = rows.reduce((a, r) => ({in: a.in + (r.usage?.input_tokens ?? 0), out: a.out + (r.usage?.output_tokens ?? 0)}), {in: 0, out: 0});
console.log(`\nTokens used by the scored runs: ${usage.in.toLocaleString("en-US")} in, ${usage.out.toLocaleString("en-US")} out.`);
