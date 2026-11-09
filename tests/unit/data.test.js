// Data evals: the live data has no errors, and each kind of mistake we care about is caught.
// The mistake tests edit a frozen copy of the data, so a data refresh never fails them.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {checkData, loadData} from "../../scripts/lib/data-checks.js";
import {formatJson} from "../../scripts/lib/json-format.js";

const live = loadData(path.resolve(import.meta.dirname, "../../data"));
const real = loadData(path.resolve(import.meta.dirname, "fixtures/data-2026-10-16"));
const copy = () => structuredClone(real);
const TODAY = "2026-11-09";
const errorsOf = (d, o = {}) => checkData(d, {today: TODAY, ...o}).errors;
const warningsOf = (d, o = {}) => checkData(d, {today: TODAY, ...o}).warnings;
const has = (list, re) => assert.ok(list.some(x => re.test(x)), `expected a message matching ${re}, got:\n${list.join("\n")}`);

test("the data in data/ has no errors", () => {
  assert.deepEqual(checkData(live).errors, []); // warnings are for a person to judge on the pull request
});

test("the frozen copy passes every check", () => {
  assert.deepEqual(checkData(real, {base: real, today: TODAY}), {errors: [], warnings: []});
});

test("schema: a missing field, a bad date and an unknown field are errors", () => {
  const d = copy();
  delete d.schools.schools[0].addr;
  d.events.events[0].date = "2026-13-01";
  d.steps.steps[0].extra = 1;
  const e = errorsOf(d);
  has(e, /schools\.json\/schools\/0: must have required property 'addr'/);
  has(e, /events\.json\/events\/0/);
  has(e, /steps\.json\/steps\/0: must NOT have additional properties \(extra\)/);
});

test("an open house for a school that isn't listed is an error", () => {
  const d = copy();
  d.events.events[0].dbn = "20K999";
  has(errorsOf(d), /school 20K999 is not in schools\.json/);
});

test("duplicate IDs are errors", () => {
  const d = copy();
  d.events.events.push(structuredClone(d.events.events[0]));
  d.schools.schools.push(structuredClone(d.schools.schools[0]));
  const e = errorsOf(d);
  has(e, /event ID oh-20K030-2026-10-28-1630 appears more than once/);
  has(e, /DBN 20K030 appears more than once/);
});

test("an event that ends before it starts, or falls outside the cycle, is an error", () => {
  const d = copy();
  d.events.events[0].end = "15:00";
  d.events.events[1].date = "2028-01-10";
  const e = errorsOf(d);
  has(e, /ends \(15:00\) before it starts/);
  has(e, /outside the 2027 admissions cycle/);
});

test("removing an ID that plans may reference is an error, unless the event is retired", () => {
  const d = copy();
  const [gone] = d.events.events.splice(0, 1);
  d.schools.schools.pop();
  d.neighborhoods.neighborhoods.pop();
  let e = errorsOf(d, {base: real});
  has(e, new RegExp(`event ${gone.id} was removed`));
  has(e, /school 20K936 was removed/);
  has(e, /gravesend was removed/);
  d.events.retired_ids.push(gone.id);
  e = errorsOf(d, {base: real});
  assert.ok(!e.some(x => x.includes(gone.id)));
});

test("moving an open house without recording the old time is a warning; with \"was\" it is fine", () => {
  const d = copy();
  const ev = d.events.events.find(e => e.id === "oh-20K187-2026-11-10-1730");
  ev.start = "18:00";
  has(warningsOf(d, {base: real}), /oh-20K187-2026-11-10-1730: date or time changed without "was"/);
  ev.was = {date: "2026-11-10", start: "17:30"};
  assert.deepEqual(warningsOf(d, {base: real}), []);
});

test("highlights that quote a number different from the data are a warning", () => {
  const d = copy();
  d.schools.schools.find(s => s.dbn === "20K187").math = 95;
  has(warningsOf(d), /20K187: text says "96% math" but math is 95/);
  const ms407 = d.schools.schools.find(s => s.dbn === "20K407");
  Object.assign(ms407, {math: 68, ela: 68});
  has(warningsOf(d), /20K407: text says "too new for full test results"/);
});

test("open house dates not checked for a month during application season are a warning", () => {
  has(warningsOf(real, {today: "2026-11-30"}), /last checked 2026-10-16 \(45 days ago\) during application season/);
  assert.deepEqual(warningsOf(real, {today: "2027-01-20"}), []); // after the deadline
});

test("formatJson keeps the data identical and puts one field per line", () => {
  const out = formatJson(real.schools);
  assert.deepEqual(JSON.parse(out), real.schools);
  assert.match(out, /\n {6}"math": null,\n/);
  assert.match(out, /"concerns": \["Very large school \(1,526 students\); may feel too big for some", "No subway nearby"\]/);
});
