// Pull the latest state test results for our schools from NYC Open Data and update data/schools.json.
// Only math and ela (grades 6 to 8) and the citywide averages are touched; everything else is hand-curated.
// Usage: node scripts/refresh-data.js [--summary <file.md>]
import fs from "node:fs";
import path from "node:path";
import {formatJson} from "./lib/json-format.js";

const DATASET = "dnpx-dfnc"; // School Quality Reports Data
const API = `https://data.cityofnewyork.us/resource/${DATASET}.json`;
const METRICS = ["mth", "ela"].flatMap(s => [6, 7, 8].map(g => `prof_pct_${s}_${g}gr`));
const FIELD = {mth: "math", ela: "ela"};

const file = path.resolve(import.meta.dirname, "../data/schools.json");
const i = process.argv.indexOf("--summary"), summaryFile = i > 0 ? process.argv[i + 1] : null;

async function get(url, params = {}) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u, {headers: {accept: "application/json"}});
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${u}`);
  return res.json();
}
const sql = list => list.map(x => `'${x.replace(/'/g, "''")}'`).join(",");

// Percent of students at level 3 or 4 across grades 6 to 8, weighted by how many students tested in each grade.
function weighted(rows) {
  const out = {};
  for (const r of rows) {
    if (r.metric_value == null || !r.number_of_students) continue;
    const key = (r.dbn || "city") + ":" + FIELD[r.metric_variable_name.split("_")[2]];
    const n = Number(r.number_of_students), v = Number(r.metric_value);
    (out[key] ||= [0, 0])[0] += v * n; out[key][1] += n;
  }
  return Object.fromEntries(Object.entries(out).map(([k, [x, n]]) => [k, Math.round(100 * x / n)]));
}

const data = JSON.parse(fs.readFileSync(file, "utf8"));
const dbns = data.schools.map(s => s.dbn);

const meta = await get(`https://data.cityofnewyork.us/api/views/${DATASET}.json`);
const published = new Date(meta.rowsUpdatedAt * 1000).toISOString().slice(0, 10);
const [{year}] = await get(API, {$select: "max(school_year) as year", $where: "report_type='EMS'"});
const period = `${year}-${String(Number(year) + 1).slice(2)}`;
const where = `school_year='${year}' AND report_type='EMS' AND metric_variable_name in(${sql(METRICS)})`;

const schoolRows = await get(API, {$select: "dbn,metric_variable_name,number_of_students,metric_value", $where: `${where} AND dbn in(${sql(dbns)})`, $limit: "5000"});
if (!schoolRows.length) throw new Error(`No ${period} results for any of our ${dbns.length} schools. Has the dataset changed?`);
const cityRows = await get(API, {
  $select: "metric_variable_name,sum(metric_value::number*number_of_students::number) as x,sum(number_of_students::number) as n",
  $where: `${where} AND metric_value IS NOT NULL`, $group: "metric_variable_name",
});
const scores = weighted(schoolRows);
const city = weighted(cityRows.map(r => ({metric_variable_name: r.metric_variable_name, metric_value: Number(r.x) / Number(r.n), number_of_students: r.n})));

const changes = [], missing = [];
const prov = {source: "nyc-sqr", as_of: published, period};
for (const s of data.schools) {
  const next = {math: scores[s.dbn + ":math"] ?? null, ela: scores[s.dbn + ":ela"] ?? null};
  if (next.math == null && next.ela == null) { missing.push(s.dbn); continue; } // keep what we have
  for (const k of ["math", "ela"]) if (s[k] !== next[k]) changes.push([s.short, k, s[k], next[k]]);
  Object.assign(s, next);
  s.provenance.scores = prov;
}
const c = data.city_averages;
for (const k of ["math", "ela"]) if (city["city:" + k] != null && c[k] !== city["city:" + k]) { changes.push(["Citywide average", k, c[k], city["city:" + k]]); c[k] = city["city:" + k]; }
c.provenance.scores = prov;

const before = fs.readFileSync(file, "utf8"), after = formatJson(data);
if (after !== before) fs.writeFileSync(file, after);

const label = {math: "Math", ela: "Reading"};
const summary = [
  `Test results from **NYC School Quality Reports** ([${DATASET}](https://data.cityofnewyork.us/d/${DATASET})), ${period} school year, published ${published}.`,
  "Percent of students in grades 6 to 8 at level 3 or 4 on the state tests, weighted by students tested in each grade.",
  "",
  changes.length ? "| School | Subject | Was | Now |\n|---|---|---|---|\n" + changes.map(([n, k, a, b]) => `| ${n} | ${label[k]} | ${a ?? "none"} | ${b ?? "none"} |`).join("\n") : "No score changes.",
  missing.length ? `\nNo ${period} results for ${missing.join(", ")}; kept the current numbers.` : "",
  "",
  "Survey numbers (feels safe, bullying, teachers), open houses, highlights and concerns are hand-curated and were not changed.",
].join("\n");
if (summaryFile) fs.writeFileSync(summaryFile, summary + "\n");
console.log(after === before ? "data/schools.json is already up to date." : `Updated data/schools.json: ${changes.length} score changes.`);
console.log(summary);
