// Check the sources in data/schools.json that have a "watch" list, and say which changed since a person
// last updated our data from them. It never changes data/*.json: a person does that, then accepts.
//   node scripts/watch-sources.js                    report changes
//   node scripts/watch-sources.js --issues <file>    also write one issue (title, body) per changed source
//   node scripts/watch-sources.js --accept [source]  record what the pages look like now (after updating our data)
import fs from "node:fs";
import path from "node:path";
import {fingerprint, openDataId} from "./lib/watch.js";
import {formatJson} from "./lib/json-format.js";

const root = path.resolve(import.meta.dirname, "..");
const stateFile = path.join(root, "data/watch.json");
const {sources} = JSON.parse(fs.readFileSync(path.join(root, "data/schools.json"), "utf8"));
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : {};
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] ?? true : null; };
const accept = arg("--accept"), issuesFile = arg("--issues");
const today = new Date().toISOString().slice(0, 10);

async function look(url) {
  const id = openDataId(url);
  const res = await fetch(id ? `https://data.cityofnewyork.us/api/views/${id}.json` : url,
    {headers: {"user-agent": "D20 Middle School Planner source watch (github.com/piggietori/Middle-School-Planner)"}, signal: AbortSignal.timeout(30000)});
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  if (id) return `data updated ${new Date((await res.json()).rowsUpdatedAt * 1000).toISOString().slice(0, 10)}`;
  return fingerprint(await res.text());
}

const issues = [];
let failed = 0;
for (const [key, src] of Object.entries(sources)) {
  if (!src.watch || (typeof accept === "string" && accept !== key)) continue;
  const changed = [];
  for (const url of src.watch) {
    let now;
    try { now = await look(url); } catch (e) { console.log(`FAIL ${key} ${url}: ${e.message}`); failed++; continue; }
    const was = state[url];
    if (accept) { state[url] = {fingerprint: now, accepted: today}; console.log(`accepted ${key} ${url}`); continue; }
    if (was?.fingerprint === now) { console.log(`same ${key} ${url}`); continue; }
    console.log(`CHANGED ${key} ${url}`);
    changed.push(`- ${url}${was ? ` (last updated from it ${was.accepted})` : " (never recorded)"}${now.startsWith("data updated") ? `: ${now}` : ""}`);
  }
  if (changed.length) issues.push({
    title: `Source changed: ${src.name}`,
    body: [`This source changed since we last updated our data from it:`, "", ...changed, "", `**What to do:** ${src.update}`, "",
      `Then record that you checked it, in the same pull request: \`node scripts/watch-sources.js --accept ${key}\` and commit \`data/watch.json\`.`,
      "", "Opened by the *Watch sources* workflow."].join("\n"),
  });
}

if (accept) fs.writeFileSync(stateFile, formatJson(state));
if (issuesFile) fs.writeFileSync(issuesFile, JSON.stringify(issues));
console.log(accept ? "\nSaved data/watch.json" : `\n${issues.length} source(s) changed${failed ? `, ${failed} page(s) couldn't be checked` : ""}`);
process.exit(failed ? 1 : 0);
