// Golden cases for the match score. These lock in the MVP ranking: if a code change moves a score,
// the test fails and the new numbers have to be reviewed and copied in on purpose. They run against a
// frozen copy of the school data, so a data refresh never fails them.
import test from "node:test";
import assert from "node:assert/strict";
import {match, ranked, label} from "../../src/match.js";
import fixture from "./fixtures/data-2026-10-16/schools.json" with {type: "json"};

const SCHOOLS = fixture.schools, BY = Object.fromEntries(SCHOOLS.map(s => [s.dbn, s]));

const base = {home:"",maxMiles:1.5,needSubway:false,skipCompetitive:false,w:{distance:2,scores:1,safety:2,bullying:1,teachers:1},programs:[]};

const golden = [
  ["no home, default priorities", base,
    [["20K187",96],["20K686",91],["20K407",80],["20K201",75],["20K229",73],["20K936",71],["20K180",66],["20K062",61],["20K104",55],["20K259",54],["20K227",50],["20K220",49],["20K609",42],["20K192",39],["20K223",32],["20K030",15]]],
  ["Dyker Heights, music and STEM", {...base,home:"dyker",programs:["music","stem"]},
    [["20K187",95],["20K201",75],["20K407",75],["20K229",73],["20K227",71],["20K259",59],["20K936",51],["20K180",48],["20K104",46],["20K686",43],["20K220",33],["20K192",29],["20K030",21],["20K609",21],["20K062",20],["20K223",17]]],
  ["Sunset Park, subway required, 1 mile", {...base,home:"sunset",needSubway:true,maxMiles:1},
    [["20K936",78],["20K220",60],["20K187",55],["20K686",49],["20K180",41],["20K407",40],["20K259",32],["20K201",30],["20K229",29],["20K104",28],["20K227",28],["20K609",28],["20K062",27],["20K223",23],["20K192",21],["20K030",20]]],
  ["Bensonhurst, scores very important, hide competitive", {...base,home:"bens",skipCompetitive:true,w:{distance:1,scores:2,safety:1,bullying:0,teachers:0}},
    [["20K201",75],["20K180",68],["20K229",66],["20K259",59],["20K407",56],["20K227",51],["20K192",42],["20K220",33],["20K104",32],["20K609",30],["20K062",29],["20K223",23],["20K030",17]]],
];

for (const [name, plan, want] of golden)
  test(`ranking: ${name}`, () => assert.deepEqual(ranked(plan, SCHOOLS).map(m => [m.s.dbn, m.score]), want));

test("schools with no test results count as below average and say so", () => {
  const m = match(BY["20K407"], base);
  assert.ok(m.warn.includes("Too new for full test results"));
});

test("far schools lose points and explain why", () => {
  const near = match(BY["20K201"], {...base, home:"dyker"}), far = match(BY["20K201"], {...base, home:"kens"});
  assert.ok(far.score < near.score);
  assert.match(far.warn[0], /^Farther than you want/);
});

test("match labels", () => {
  assert.deepEqual([78, 62, 48, 47].map(n => label(n)[0]), ["Great match", "Good match", "Possible", "Weak match"]);
});
