// Number bullets on the school sheet: the same rule and wording for every school.
import test from "node:test";
import assert from "node:assert/strict";
import {facts, MARGIN, LARGE} from "../../src/facts.js";

const CITY = {math: 56, ela: 57, safe: 80, bully: 59, teach: 85};
// A school exactly at the citywide averages, mid-sized, with a subway: nothing to say about it.
const average = {math: 56, ela: 57, safe: 80, bully: 59, teach: 85, size: 800, subway: [{l: ["R"], st: "Bay Ridge Av"}]};
const school = over => ({...average, ...over});

test("a school at the citywide averages earns no number bullets", () => {
  assert.deepEqual(facts(average, CITY), {good: [], concerns: []});
});

test("a number is a highlight or a concern only from MARGIN points away from citywide", () => {
  assert.equal(MARGIN, 5);
  assert.deepEqual(facts(school({safe: 84}), CITY), {good: [], concerns: []});
  assert.deepEqual(facts(school({safe: 85}), CITY).good, ["85% of students feel safe (citywide 80%)"]);
  assert.deepEqual(facts(school({safe: 76}), CITY), {good: [], concerns: []});
  assert.deepEqual(facts(school({safe: 75}), CITY).concerns, ["75% of students feel safe (citywide 80%)"]);
  assert.deepEqual(facts(school({teach: 90}), CITY).good, ["90% of teachers would recommend the school (citywide 85%)"]);
  assert.deepEqual(facts(school({teach: 80}), CITY).concerns, ["80% of teachers would recommend the school (citywide 85%)"]);
});

test("for bullying, lower is better", () => {
  assert.deepEqual(facts(school({bully: 54}), CITY).good, ["54% of students say bullying happens often (citywide 59%)"]);
  assert.deepEqual(facts(school({bully: 64}), CITY).concerns, ["64% of students say bullying happens often (citywide 59%)"]);
  assert.deepEqual(facts(school({bully: 60}), CITY), {good: [], concerns: []});
});

test("test results are judged on math and reading together, and both are shown", () => {
  assert.deepEqual(facts(school({math: 78, ela: 56}), CITY).good, ["78% math, 56% reading passing (citywide 56%, 57%)"]);
  assert.deepEqual(facts(school({math: 51, ela: 52}), CITY).concerns, ["51% math, 52% reading passing (citywide 56%, 57%)"]);
  assert.deepEqual(facts(school({math: 60, ela: 61}), CITY), {good: [], concerns: []});
});

test("a missing number earns no bullet; one test subject alone is compared with its own citywide average", () => {
  assert.deepEqual(facts(school({bully: null, teach: null, math: null, ela: null}), CITY), {good: [], concerns: []});
  assert.deepEqual(facts(school({math: null, ela: 50}), CITY).concerns, ["50% reading passing (citywide 57%)"]);
});

test("large schools and schools with no subway are always flagged", () => {
  assert.equal(LARGE, 1150);
  assert.deepEqual(facts(school({size: 1149}), CITY).concerns, []);
  assert.deepEqual(facts(school({size: 1482, subway: []}), CITY).concerns, ["Large school: 1,482 students", "No subway nearby"]);
});
