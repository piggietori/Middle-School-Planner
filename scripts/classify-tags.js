// Ask the classifier which of music, arts and science & tech each school earns, and print its answers
// next to our tags. It proposes only; nothing is written. Needs ANTHROPIC_API_KEY in your shell and costs
// one model call per school. Run `npm run fetch:tag-sources` first.
// Usage: node scripts/classify-tags.js [DBN ...]
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import {MODEL, classify} from "./lib/tag-classifier.js";
import {PROSE_TAGS} from "./lib/tag-rules.js";
import {loadSource, quoteFound} from "./lib/tag-sources.js";

const data = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../data/schools.json"), "utf8"));
const only = process.argv.slice(2);
const schools = data.schools.filter(s => !only.length || only.includes(s.dbn));
if (!schools.length) { console.error("No school with that DBN."); process.exit(2); }
if (!process.env.ANTHROPIC_API_KEY) { console.error("Set ANTHROPIC_API_KEY in your shell first. It is never stored in this repository."); process.exit(2); }

const client = new Anthropic();
console.log(`Model: ${MODEL}\n\n| School | Tag | Model | Ours | Rests on |\n|---|---|---|---|---|`);
let differ = 0;
for (const s of schools) {
  const source = loadSource(s.dbn);
  const {answer, stop_reason} = await classify(client, source);
  if (!answer) { console.log(`| ${s.short} | | no answer (${stop_reason}) | | |`); continue; }
  for (const t of PROSE_TAGS) {
    const d = answer[t], ours = s.tags.includes(t);
    if (d.answer !== ours) differ++;
    const quotes = d.quotes.map(q => `"${q}"${quoteFound(source, q) ? "" : " (NOT in the source text)"}`).join("; ");
    console.log(`| ${s.short} | ${data.programs[t]} | ${d.answer ? "yes" : "no"}${d.answer !== ours ? " ⚠" : ""} | ${ours ? "yes" : "no"} | ${quotes || d.reason} |`);
  }
}
console.log(`\n${differ} answer(s) differ from our tags. A person decides; change a tag only with its evidence (docs/data-sources.md, Program tags).`);
