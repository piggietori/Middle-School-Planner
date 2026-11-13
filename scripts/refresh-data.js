// Pull the numbers that have a source we can read and update data/schools.json:
//   - state test results (math and ela, grades 6 to 8) and their citywide averages, from NYC Open Data;
//   - NYC School Survey answers (safe, bully, teach), their citywide averages and enrollment (size),
//     from each school's InsideSchools profile.
// Everything else is hand-curated. A number the source doesn't have is never blanked: we keep ours and say so.
// Usage: node scripts/refresh-data.js [--summary <file.md>]
import fs from "node:fs";
import path from "node:path";
import {formatJson} from "./lib/json-format.js";
import {parseProfile, profileUrl} from "./lib/insideschools.js";

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

// Survey answers and enrollment, one profile page per school.
const SURVEY = ["safe", "bully", "teach"];
async function page(url) {
  const res = await fetch(url, {headers: {"user-agent": "school data refresh"}, signal: AbortSignal.timeout(30000)});
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}
const profiles = [], unread = [], gaps = [];
for (const s of data.schools) {
  try { profiles.push([s, parseProfile(await page(profileUrl(s.dbn)))]); }
  catch (e) { unread.push(`${s.short} (${e.message})`); }
  await new Promise(r => setTimeout(r, 300));
}
if (!profiles.length) throw new Error(`Could not read any InsideSchools profile: ${unread[0]}`);
const mark = changes.length;
for (const [s, p] of profiles) for (const k of [...SURVEY, "size"]) {
  if (p[k] == null) { gaps.push(`${s.short}: ${k}${s[k] == null ? "" : ` (kept ${s[k]})`}`); continue; }
  if (s[k] !== p[k]) { changes.push([s.short, k, s[k], p[k]]); s[k] = p[k]; }
}
// InsideSchools compares each school with schools of its kind, so K-8 and 6-12 schools show another
// citywide figure. We keep one benchmark: the one most of our schools are compared with.
const otherCity = new Set();
for (const k of SURVEY) {
  const seen = profiles.map(([, p]) => p.city[k]).filter(v => v != null);
  if (!seen.length) continue;
  const count = v => seen.filter(x => x === v).length;
  const top = [...new Set(seen)].sort((a, b) => count(b) - count(a))[0];
  for (const [s, p] of profiles) if (p.city[k] != null && p.city[k] !== top) otherCity.add(s.short);
  if (c[k] !== top) { changes.push(["Citywide average", k, c[k], top]); c[k] = top; }
}
// "Last checked" moves only when something did, so a week with no news opens no pull request.
const surveyPeriod = profiles[0][1].period;
if (changes.length > mark || profiles.some(([s, p]) => s.provenance.survey.period !== p.period)) {
  const today = new Date().toISOString().slice(0, 10);
  for (const [s, p] of profiles) s.provenance.survey = {source: "insideschools", as_of: today, period: p.period};
  c.provenance.survey = {source: "insideschools", as_of: today, period: surveyPeriod};
}

const before = fs.readFileSync(file, "utf8"), after = formatJson(data);
if (after !== before) fs.writeFileSync(file, after);

const label = {math: "Math", ela: "Reading", safe: "Feel safe", bully: "Bullying", teach: "Teachers recommend", size: "Students"};
const summary = [
  `Test results from **NYC School Quality Reports** ([${DATASET}](https://data.cityofnewyork.us/d/${DATASET})), ${period} school year, published ${published}.`,
  "Percent of students in grades 6 to 8 at level 3 or 4 on the state tests, weighted by students tested in each grade.",
  "",
  `Survey answers (feel safe, bullying, teachers recommend) and enrollment from each school's **InsideSchools** profile, ${surveyPeriod} NYC School Survey.`,
  "",
  changes.length ? "| School | Number | Was | Now |\n|---|---|---|---|\n" + changes.map(([n, k, a, b]) => `| ${n} | ${label[k]} | ${a ?? "none"} | ${b ?? "none"} |`).join("\n") : "No changes.",
  missing.length ? `\nNo ${period} test results for ${missing.join(", ")}; kept the current numbers.` : "",
  gaps.length ? `\nNot shown on InsideSchools: ${gaps.join("; ")}.` : "",
  unread.length ? `\n**Could not read** the InsideSchools profile for ${unread.join("; ")}. Those schools were not checked.` : "",
  otherCity.size ? `\nInsideSchools compares ${[...otherCity].join(", ")} with a different citywide figure (schools with other grades). We show one citywide average for every school.` : "",
  "",
  "Open houses, programs, highlights and concerns are hand-curated and were not changed. If a highlight or concern quotes a number that changed, the data checks say which.",
].join("\n");
if (summaryFile) fs.writeFileSync(summaryFile, summary + "\n");
console.log(after === before ? "data/schools.json is already up to date." : `Updated data/schools.json: ${changes.length} changes.`);
console.log(summary);
