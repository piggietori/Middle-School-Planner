// Honors, dual language and special-ed tags follow a school's InsideSchools program list by one rule.
import test from "node:test";
import assert from "node:assert/strict";
import {listEvidence, listTags, STAFF_PICK} from "../../scripts/lib/tag-rules.js";

const P = (name, method) => ({name, method});
const listed = (programs, staff_pick_sped = false) => ({programs, staff_pick_sped});

test("a screened program earns honors; zoned, open and audition programs don't", () => {
  assert.deepEqual(listTags(listed([P("Superintendent's Program", "Screened"), P("Zoned Program", "Zone Priority")])), ["honors"]);
  assert.deepEqual(listTags(listed([P("Academy for Scientific Research", "Screened")])), ["honors"]);
  assert.deepEqual(listTags(listed([P("Federal Magnet Program", "Open"), P("M.S. 936", "Audition"), P("Zoned Program", "Zone Priority")])), []);
});

test("a dual language program earns dual language", () => {
  assert.deepEqual(listTags(listed([P("Arabic Dual Language", "Language Criteria")])), ["language"]);
  assert.deepEqual(listTags(listed([P("Spanish Dual Language Program", "")])), ["language"]);
});

test("a specialized program or the staff pick earns special-ed support; nothing else does", () => {
  for (const p of [P("M.S. 407 ASD Nest Program", "ASD/ACES Program"), P("J.H.S. 062 Ditmas ASD Horizon Program", "ASD/ACES Program"),
    P("The Christa Mcauliffe School ACES 12:1:1 Program", "ASD/ACES Program"), P("The SEEALL Academy D75 Inclusion Program", "D75 Special Education Inclusive Services")])
    assert.deepEqual(listTags(listed([p])), ["sped"], p.name);
  assert.deepEqual(listTags(listed([], true)), ["sped"]);
  assert.deepEqual(listTags(listed([P("Civic Leadership and Responsibility", "Zone Priority")])), []);
  assert.deepEqual(listTags(listed([])), []);
});

test("the evidence for a tag is the names of the programs that support it", () => {
  const l = listed([P("Algebra Honors Program", "Screened"), P("Superintendent's Program", "Screened"), P("Zoned Program", "Zone Priority")], true);
  assert.deepEqual(listEvidence(l), {honors: ["Algebra Honors Program", "Superintendent's Program"], language: [], sped: [STAFF_PICK]});
});
