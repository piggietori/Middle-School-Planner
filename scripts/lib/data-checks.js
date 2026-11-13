// Data evals for data/*.json. Errors block a merge; warnings are shown on the pull request for a person to judge.
import Ajv from "ajv/dist/2020.js";
import fs from "node:fs";
import path from "node:path";

export const FILES = ["schools", "events", "neighborhoods", "steps", "notice"];
const schemaDir = path.resolve(import.meta.dirname, "../../data/schema");

let validators;
function schemas() {
  if (validators) return validators;
  const ajv = new Ajv({allErrors: true, strict: false});
  for (const f of fs.readdirSync(schemaDir)) ajv.addSchema(JSON.parse(fs.readFileSync(path.join(schemaDir, f), "utf8")));
  validators = Object.fromEntries(FILES.map(f => [f, ajv.getSchema(`${f}.schema.json`)]));
  return validators;
}

const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const dupes = list => list.filter((x, i) => list.indexOf(x) !== i);

// What the school sheet and the Find cards already say by rule, from the numbers (src/facts.js): test results,
// feel safe, bullying, teachers recommend, a large school, no subway. A highlight or concern we type must not
// say it again: it would show twice, or give one school a bullet that others with the same number don't get.
export const GENERATED = [
  /\d+%[^.;]*\b(?:math|reading)\b|\b(?:math|reading)\b[^.;]*\d+%/i,
  /feel safe/i,
  /\d+%[^.;]*bullying/i,
  /\d+%[^.;]*teachers would recommend/i,
  /\d[\d,]{2,} students/i,
  /no subway/i,
];

/**
 * @param data  {schools, events, neighborhoods, steps}: parsed data files
 * @param opts  base: the same files on the target branch (or null), today: "YYYY-MM-DD"
 */
export function checkData(data, {base = null, today = new Date().toISOString().slice(0, 10)} = {}) {
  const errors = [], warnings = [];
  for (const f of FILES) {
    const v = schemas()[f];
    if (!v(data[f])) for (const e of v.errors) errors.push(`${f}.json${e.instancePath || ""}: ${e.message}${e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : ""}`);
  }
  if (errors.length) return {errors, warnings}; // the checks below assume the right shape

  const {schools: sf, events: ef, neighborhoods: nf, steps: tf} = data;
  const schools = sf.schools, events = ef.events;
  const dbns = schools.map(s => s.dbn), ids = events.map(e => e.id);
  for (const d of dupes(dbns)) errors.push(`schools.json: DBN ${d} appears more than once`);
  for (const d of dupes(ids)) errors.push(`events.json: event ID ${d} appears more than once`);
  for (const d of dupes(nf.neighborhoods.map(n => n.id))) errors.push(`neighborhoods.json: ID ${d} appears more than once`);
  for (const d of dupes(tf.steps.map(s => s.id))) errors.push(`steps.json: step ID ${d} appears more than once`);
  for (const f of ["events", "steps"]) if (data[f].cycle !== sf.cycle) errors.push(`${f}.json: cycle ${data[f].cycle} does not match schools.json cycle ${sf.cycle}`);

  const cycle = +sf.cycle, from = `${cycle - 1}-09-01`, to = `${cycle}-06-30`;
  for (const s of schools) {
    for (const t of s.tags) if (!sf.programs[t]) errors.push(`schools.json ${s.dbn}: tag "${t}" is not in programs`);
    for (const [k, p] of Object.entries(s.provenance)) if (!sf.sources[p.source]) errors.push(`schools.json ${s.dbn}: ${k} source "${p.source}" is not in sources`);
  }
  for (const e of events) {
    if (e.kind === "open" && !dbns.includes(e.dbn)) errors.push(`events.json ${e.id}: school ${e.dbn} is not in schools.json`);
    if (!sf.sources[e.source]) errors.push(`events.json ${e.id}: source "${e.source}" is not in schools.json sources`);
    if (e.start && e.end && e.end <= e.start) errors.push(`events.json ${e.id}: ends (${e.end}) before it starts (${e.start})`);
    if (e.date < from || e.date > to) errors.push(`events.json ${e.id}: ${e.date} is outside the ${sf.cycle} admissions cycle (${from} to ${to})`);
    if (e.was && e.was.date === e.date && (e.was.start ?? e.start) === e.start && (e.was.end ?? e.end) === e.end) errors.push(`events.json ${e.id}: "was" is the same as the current date and time`);
  }
  for (const id of ef.retired_ids) if (ids.includes(id)) errors.push(`events.json: ${id} is retired but still listed`);
  // The app reads the deadline and offer day from these; steps can name any key date as {k-...}.
  for (const id of ["k-close", "k-offer"]) if (!events.some(e => e.id === id && e.kind === "key")) errors.push(`events.json: key date ${id} is missing (the countdown and steps use it)`);
  for (const s of tf.steps) for (const [, id] of `${s.t} ${s.d}`.matchAll(/\{(k-[\w-]+)\}/g)) if (!events.some(e => e.id === id && e.kind === "key")) errors.push(`steps.json ${s.id}: {${id}} is not a key date in events.json`);

  // Plans store these IDs. Removing one silently breaks saved schools, visits, homes or steps.
  if (base) {
    const gone = (was, now) => was.filter(x => !now.includes(x));
    if (base.schools) for (const d of gone(base.schools.schools.map(s => s.dbn), dbns)) errors.push(`schools.json: school ${d} was removed. Families may have it saved; keep it or plan a migration`);
    if (base.events) for (const id of gone(base.events.events.map(e => e.id), [...ids, ...ef.retired_ids])) errors.push(`events.json: event ${id} was removed. Keep its ID (change the date or time instead) or add it to retired_ids`);
    if (base.neighborhoods) for (const id of gone(base.neighborhoods.neighborhoods.map(n => n.id), nf.neighborhoods.map(n => n.id))) errors.push(`neighborhoods.json: ${id} was removed. Families may have it as their home`);
    if (base.steps) for (const id of gone(base.steps.steps.map(s => s.id), tf.steps.map(s => s.id))) errors.push(`steps.json: step ${id} was removed. Families may have it checked off`);
    if (base.events) for (const e of events) {
      const old = base.events.events.find(o => o.id === e.id);
      if (old && (old.date !== e.date || old.start !== e.start || old.end !== e.end) && !e.was) warnings.push(`events.json ${e.id}: date or time changed without "was", so families who planned to go won't see that it moved`);
    }
    if (base.schools) for (const s of schools) {
      const old = base.schools.schools.find(o => o.dbn === s.dbn);
      for (const k of ["math", "ela", "safe", "bully", "teach"]) if (old && old[k] != null && s[k] != null && Math.abs(old[k] - s[k]) >= 15) warnings.push(`schools.json ${s.dbn}: ${k} moved ${old[k]} → ${s[k]}. Check this is real`);
    }
  }

  // Freshness: open houses change often in application season; school facts about once a year.
  // Highlights and concerns we type cover what numbers can't say; the numbers we hold have their own bullets.
  // Numbers with no field of their own (attendance, suspensions, class size) are allowed, and can't be checked.
  for (const s of schools) for (const text of [...s.good, ...s.concerns]) {
    const m = GENERATED.map(re => text.match(re)).find(Boolean);
    if (m) warnings.push(`schools.json ${s.dbn}: "${text}" repeats something the sheet already shows by rule ("${m[0]}"). Remove it, or reword it without that`);
    if (/too new for full test results/i.test(text) && s.math != null && s.ela != null) warnings.push(`schools.json ${s.dbn}: text says "too new for full test results" but there are now test results. Update the text`);
  }

  const close = events.find(e => e.id === "k-close")?.date;
  const season = close && today >= from && today <= close;
  if (season) for (const e of events) if (days(e.as_of, today) > 30) warnings.push(`events.json ${e.id}: last checked ${e.as_of} (${days(e.as_of, today)} days ago) during application season`);
  const n = data.notice.notice;
  if (n?.until && n.until < today) warnings.push(`notice.json: the banner ended on ${n.until}. Set "notice" to null`);
  for (const s of schools) for (const [k, p] of Object.entries(s.provenance)) if (days(p.as_of, today) > 400) warnings.push(`schools.json ${s.dbn}: ${k} last checked ${p.as_of}`);
  return {errors, warnings};
}

export const loadData = dir => Object.fromEntries(FILES.map(f => [f, JSON.parse(fs.readFileSync(path.join(dir, `${f}.json`), "utf8"))]));
