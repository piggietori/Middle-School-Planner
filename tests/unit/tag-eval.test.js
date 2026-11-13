// The tag classifier eval's grading, with no model and no network: answers are compared with ours, quotes
// must be in the source word for word, and the summary counts wrong yeses and wrong nos separately.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {PROSE_RULES, PROSE_TAGS} from "../../scripts/lib/tag-rules.js";
import {pageText, quoteFound, sourceText} from "../../scripts/lib/tag-sources.js";
import {gradeSchool, summarize} from "../../scripts/lib/tag-eval.js";
import {Answer, SYSTEM, classify, userMessage} from "../../scripts/lib/tag-classifier.js";

const root = path.resolve(import.meta.dirname, "../..");
const SOURCE = "== InsideSchools review ==\nIt has a marching band as well as programs in drama, studio art and chorus. “Code squads” help classmates.\n";
const yes = (...quotes) => ({answer: true, quotes, reason: "named"});
const no = {answer: false, quotes: [], reason: "not named"};
const OURS = {music: true, arts: true, stem: false};
const band = "It has a marching band as well as programs in drama, studio art and chorus.";

test("the rules the classifier is given are the rules in the docs, word for word", () => {
  const docs = fs.readFileSync(path.join(root, "docs/data-sources.md"), "utf8").replace(/\r\n/g, "\n");
  for (const t of PROSE_TAGS) {
    assert.ok(docs.includes(`| ${PROSE_RULES[t]} |`), `docs/data-sources.md no longer has the ${t} rule as written in tag-rules.js`);
    assert.ok(SYSTEM.includes(PROSE_RULES[t]));
  }
});

test("our own answers score full marks; answering no to everything does not", () => {
  const oracle = gradeSchool(OURS, {music: yes(band), arts: yes(band), stem: no}, SOURCE);
  assert.deepEqual(oracle.grade, {correct: 1, agree: 1, quotes_ok: 1});
  assert.deepEqual(oracle.answers, OURS);
  const nothing = gradeSchool(OURS, {music: no, arts: no, stem: no}, SOURCE);
  assert.equal(nothing.grade.correct, 0);
  assert.equal(nothing.grade.agree, 1 / 3);
  assert.match(nothing.explanation.correct, /music: said no, ours is yes/);
});

test("a yes needs a quote that is in the source word for word", () => {
  const made = gradeSchool(OURS, {music: yes("The school has a jazz band."), arts: yes(band), stem: no}, SOURCE);
  assert.deepEqual(made.grade, {correct: 1, agree: 1, quotes_ok: 0});
  assert.match(made.explanation.quotes_ok, /music: not in the source text: "The school has a jazz band\."/);
  assert.equal(gradeSchool(OURS, {music: yes(), arts: yes(band), stem: no}, SOURCE).grade.quotes_ok, 0);
});

test("quotes match across line breaks and curly or straight quote marks, and nothing shorter than a word", () => {
  assert.ok(quoteFound(SOURCE, "marching band as well\n  as programs"));
  assert.ok(quoteFound(SOURCE, '"Code squads" help classmates'));
  assert.ok(!quoteFound(SOURCE, "marching bands"));
  assert.ok(!quoteFound(SOURCE, " "));
});

test("the summary counts wrong yeses and wrong nos per tag, and lists answers that flip between runs", () => {
  const cases = [{id: "A", expected: {music: true, arts: false, stem: false}}, {id: "B", expected: {music: true, arts: false, stem: true}}];
  const row = (prompt_id, rep, music, arts, stem) => ({prompt_id, rep, answers: {music, arts, stem}});
  const s = summarize([row("A", 0, true, true, false), row("A", 1, true, false, false), row("B", 0, false, false, true), row("B", 1, false, false, true)], cases);
  assert.deepEqual({...s.tags.music, accuracy: undefined}, {tp: 2, fp: 0, tn: 0, fn: 2, precision: 1, recall: 0.5, specificity: null, accuracy: undefined});
  assert.equal(s.tags.arts.fp, 1);
  assert.equal(s.tags.arts.specificity, 0.75);
  assert.equal(s.tags.stem.accuracy, 1);
  assert.deepEqual(s.flips, [{id: "A", tag: "arts", yes: 1, runs: 2}]);
  assert.deepEqual(s.misses, [{id: "B", tag: "music", said: false, ours: true}]);
});

test("a web page becomes plain text, and the text for a school names where each part came from", () => {
  assert.equal(pageText("<style>p{}</style><p>Band &amp;amp; chorus</p><script>x()</script> &ldquo;STEAM&rdquo;&#39;s lab"), 'Band & chorus "STEAM"\'s lab');
  const t = sourceText({name: "M.S. 1", dbn: "20K001", grades: "6–8"}, {programs: [{name: "Zoned Program", method: "Zone Priority"}], review: "", pages: [{url: "https://example.org/", text: "Welcome"}]});
  assert.match(t, /== InsideSchools program list ==\n- Zoned Program \(admissions: Zone Priority\)/);
  assert.match(t, /== InsideSchools review ==\n\(none\)/);
  assert.match(t, /== School website: https:\/\/example\.org\/ ==\nWelcome/);
});

test("the classifier sends the rules and the source, and hands back the answer with what the call used", async () => {
  const answer = {music: yes(band), arts: yes(band), stem: no};
  let sent;
  const client = {messages: {parse: async req => { sent = req; return {parsed_output: answer, model: "claude-opus-5-5", usage: {input_tokens: 10, output_tokens: 5}, stop_reason: "end_turn"}; }}};
  const run = await classify(client, SOURCE);
  assert.equal(sent.model, "claude-opus-5-5");
  assert.equal(sent.system, SYSTEM);
  assert.equal(sent.messages[0].content, userMessage(SOURCE));
  assert.ok(sent.output_config.format);
  assert.deepEqual(run.answer, answer);
  assert.deepEqual(run.usage, {input_tokens: 10, output_tokens: 5});
  assert.equal(run.transcript.length, 3);
  assert.ok(Answer.safeParse(answer).success);
  // A refusal comes back as "no answer", for the runner to file as an error rather than a wrong answer.
  const refused = {messages: {parse: async () => ({parsed_output: null, model: "claude-opus-5-5", usage: {}, stop_reason: "refusal"})}};
  assert.equal((await classify(refused, SOURCE)).answer, null);
});

test("every golden case is a school we list, with a yes or no for each of the three tags", () => {
  const {cases} = JSON.parse(fs.readFileSync(path.join(root, "tests/evals/tag-cases.json"), "utf8"));
  const schools = JSON.parse(fs.readFileSync(path.join(root, "data/schools.json"), "utf8")).schools;
  assert.deepEqual(cases.map(c => c.id), schools.map(s => s.dbn));
  for (const c of cases) assert.deepEqual(Object.entries(c.expected).map(([t, v]) => [t, typeof v]), PROSE_TAGS.map(t => [t, "boolean"]));
});
