// The plan <-> rows conversion, the diff that decides what to send, and merging two plans (journey J2).
import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT, normalize, isEmpty, toRows, fromRows, diffRows, isNoop, mergePlans} from "../../src/plan-model.js";

const plan = (over = {}) => normalize({
  home: "dyker", maxMiles: 2, programs: ["music"], saved: ["20K201", "20K187"],
  going: ["oh-20K201-2026-11-09-1700", "oh-20K227-2026-10-22-1730"], attended: ["oh-20K227-2026-10-22-1730"],
  done: {s1: true, s2: true, s6: false}, notes: {"20K187": {rating: 4, pros: ["lab"], cons: [], updated: "2026-11-08T12:00:00.000Z"}},
  ...over,
});

test("a plan survives the trip to rows and back", () => {
  const p = plan();
  const back = fromRows(toRows(p));
  assert.deepEqual(back, {...p, done: {s1: true, s2: true}}); // unchecked steps aren't stored
});

test("rows look like the database expects", () => {
  const r = toRows(plan());
  assert.deepEqual(r.saved_schools, [{dbn: "20K201", rank: 1}, {dbn: "20K187", rank: 2}]);
  assert.deepEqual(r.visits, [
    {event_id: "oh-20K201-2026-11-09-1700", going: true, attended: false},
    {event_id: "oh-20K227-2026-10-22-1730", going: true, attended: true}]);
  assert.deepEqual(r.step_progress, [{step_id: "s1"}, {step_id: "s2"}]);
  assert.equal(r.plan.max_miles, 2);
});

test("rows from the server in a different shape still give the same plan", () => {
  const r = toRows(plan());
  r.plan = {...r.plan, id: "x", max_miles: "2", weights: {scores: 1, safety: 2, bullying: 1, teachers: 1, distance: 2}};
  r.saved_schools.reverse();
  r.school_notes[0].updated_at = "2026-11-08T12:00:00+00:00";
  const back = fromRows(r);
  assert.deepEqual(back.saved, ["20K201", "20K187"]);
  assert.deepEqual(toRows(back), toRows(plan()));
});

test("the diff sends only what changed", () => {
  const before = toRows(plan());
  assert.ok(isNoop(diffRows(before, toRows(plan()))));
  const p = plan();
  p.saved = ["20K187", "20K201", "20K030"]; // reorder and add
  p.attended = [];                           // unmark a visit
  delete p.notes["20K187"];
  p.home = "boro";
  const d = diffRows(before, toRows(p));
  assert.equal(d.plan.home, "boro");
  assert.deepEqual(d.upsert.saved_schools, [{dbn: "20K187", rank: 1}, {dbn: "20K201", rank: 2}, {dbn: "20K030", rank: 3}]);
  assert.deepEqual(d.upsert.visits, [{event_id: "oh-20K227-2026-10-22-1730", going: true, attended: false}]);
  assert.deepEqual(d.remove, {school_notes: ["20K187"]});
  assert.equal(d.upsert.step_progress, undefined);
});

test("isEmpty is true only for an untouched plan", () => {
  assert.ok(isEmpty(normalize(null)));
  assert.ok(isEmpty(normalize({done: {s1: false}})));
  assert.ok(!isEmpty(normalize({home: "boro"})));
  assert.ok(!isEmpty(normalize({w: {...DEFAULT.w, scores: 2}})));
});

test("merge: an empty side takes the other side whole", () => {
  assert.deepEqual(mergePlans(normalize(null), plan()), plan());
  assert.deepEqual(mergePlans(plan(), normalize(null)), plan());
});

test("merge: account order first, new schools from this device after; visits and steps combined", () => {
  const account = plan();
  const local = plan({home: "boro", saved: ["20K030", "20K187"], going: ["k-d20"], attended: [], done: {s3x: true}});
  const m = mergePlans(account, local);
  assert.equal(m.home, "dyker"); // the account's settings win
  assert.deepEqual(m.saved, ["20K201", "20K187", "20K030"]);
  assert.deepEqual(m.going, [...account.going, "k-d20"]);
  assert.deepEqual(m.attended, account.attended);
  assert.deepEqual(m.done, {s3x: true, s1: true, s2: true});
});

test("merge: settings the account never set come from this device", () => {
  const account = normalize({saved: ["20K201"]});
  const m = mergePlans(account, plan());
  assert.equal(m.home, "dyker");
  assert.equal(m.maxMiles, 2);
  assert.deepEqual(m.programs, ["music"]);
});

test("merge: for each school, the newer note wins", () => {
  const older = {rating: 2, pros: [], cons: ["far"], updated: "2026-11-01T00:00:00.000Z"};
  const newer = {rating: 5, pros: ["great"], cons: [], updated: "2026-11-09T00:00:00.000Z"};
  assert.deepEqual(mergePlans(plan({notes: {"20K201": older}}), plan({notes: {"20K201": newer}})).notes["20K201"], newer);
  assert.deepEqual(mergePlans(plan({notes: {"20K201": newer}}), plan({notes: {"20K201": older}})).notes["20K201"], newer);
  const m = mergePlans(plan({notes: {}}), plan({notes: {"20K030": older}}));
  assert.deepEqual(m.notes["20K030"], older);
});
