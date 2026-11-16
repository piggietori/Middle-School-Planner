// The tag eval's results page and run picking, with no model, no network and no files.
import test from "node:test";
import assert from "node:assert/strict";
import {gradeSchool} from "../../scripts/lib/tag-eval.js";
import {buildReport, oursThen} from "../../scripts/lib/tag-report.js";
import {nextRun} from "../../scripts/lib/tag-runs.js";

const SOURCE = "== InsideSchools review ==\nIt has a marching band. All students may study computer programming.\n";
const yes = (...quotes) => ({answer: true, quotes, reason: "named"});
const no = {answer: false, quotes: [], reason: "not named"};
const cases = [{id: "20K001", school: "JHS 1", expected: {music: true, arts: false, stem: true}, notes: {stem: "Coding counts."}}];
const schools = [{dbn: "20K001", tag_evidence: {music: [{where: "review", quote: "It has a marching band."}]}}];
// A scored row as the runner writes it, for one answer.
const row = (rep, answer, expected = cases[0].expected) => ({prompt_id: "20K001", rep, model: "m", usage: {input_tokens: 10, output_tokens: 2}, ...gradeSchool(expected, answer, SOURCE)});
const ours = {music: yes("It has a marching band."), arts: no, stem: yes("All students may study computer programming.")};
const text = html => html.replace(/<style>[\s\S]*?<\/style>/, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("a run that matches ours says there is nothing to decide", () => {
  const html = text(buildReport({variant: "v1", rows: [0, 1, 2].map(r => row(r, ours)), cases, schools}));
  assert.match(html, /Nothing to decide/);
  assert.match(html, /1 schools · 3 runs · m · 30 tokens in, 6 out/);
  assert.doesNotMatch(html, /Changed since/);
});

test("a steady disagreement gets a card with the model's quote beside our answer and note", () => {
  const wrong = {...ours, stem: no, arts: yes("It has a marching band.")};
  const rows = [0, 1, 2].map(r => row(r, wrong));
  const html = text(buildReport({variant: "v1", rows, traces: {"20K001_rep0": wrong}, cases, schools}));
  assert.match(html, /Needs your decision \(2\)/);
  assert.match(html, /JHS 1 20K001 · Science &amp; tech Same every run, not ours/);
  assert.match(html, /Run 1: yes It has a marching band\. named/);        // arts: quote and reason from the saved answer
  assert.match(html, /Run 2: yes named Quotes aren't saved/);          // no saved answer for the second run: the reason kept in the row
  assert.match(html, /Coding counts\./);
});

test("an answer that changes between runs is shown as a flip, not a disagreement", () => {
  const rows = [row(0, ours), row(1, {...ours, arts: yes("It has a marching band.")}), row(2, ours)];
  const html = text(buildReport({variant: "v1", rows, cases, schools}));
  assert.match(html, /Arts Changed between runs/);
  assert.match(html, /yes in 1 of 3 runs \(ours: no\)/);
});

test("text from a school's page or the model can't inject markup", () => {
  const evil = {...ours, arts: {answer: true, quotes: ["<script>alert(1)</script>"], reason: "<img src=x onerror=alert(1)>"}};
  const html = buildReport({
    variant: "v1", rows: [row(0, evil)], traces: {"20K001_rep0": evil}, errors: [{error: "<b>boom</b>"}],
    cases: [{...cases[0], school: "<i>JHS</i>", notes: {arts: "\"><script>x</script>"}}],
    schools: [{dbn: "20K001", tag_evidence: {arts: [{where: "website", quote: "<u>q</u>", url: "javascript:alert(1)"}]}}],
  });
  assert.doesNotMatch(html, /<script|<img|<i>|<u>|<b>boom|javascript:/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("the comparison lists the classifier's answers that moved and our answers that changed", () => {
  const before = {music: true, arts: false, stem: false};                   // our answers when the earlier run was scored
  const prevAnswer = {...ours, arts: yes("It has a marching band.")};       // said yes to all three
  const prev = {variant: "baseline", rows: [0, 1, 2].map(r => row(r, prevAnswer, before))};
  for (const t of ["music", "arts", "stem"]) assert.equal(oursThen(prev.rows[0], t), before[t]);
  const html = text(buildReport({variant: "v1", rows: [0, 1, 2].map(r => row(r, ours)), cases, schools, prev}));
  assert.match(html, /Changed since baseline Disagreements and flipped answers: 2 in baseline \(against our answers at the time\), 0 now/);
  assert.match(html, /JHS 1, Arts: classifier said yes , now no matches ours/);
  assert.match(html, /JHS 1, Science &amp; tech: ours was no , now yes/);
});

test("the next run resumes an unfinished one, and otherwise takes the next name", () => {
  const rows = n => Array.from({length: n}, (_, i) => ({prompt_id: "s" + (i % 16), rep: Math.floor(i / 16)}));
  assert.deepEqual(nextRun([], 48), {variant: "baseline", resume: false, done: 0});
  assert.deepEqual(nextRun([{variant: "baseline", rows: []}], 48), {variant: "baseline", resume: false, done: 0}); // every call failed
  assert.deepEqual(nextRun([{variant: "baseline", rows: rows(20)}], 48), {variant: "baseline", resume: true, done: 20});
  assert.deepEqual(nextRun([{variant: "baseline", rows: rows(48)}], 48), {variant: "v1", resume: false, done: 0});
  assert.deepEqual(nextRun([{variant: "baseline", rows: rows(48)}, {variant: "v1", rows: rows(48)}], 48), {variant: "v2", resume: false, done: 0});
});
