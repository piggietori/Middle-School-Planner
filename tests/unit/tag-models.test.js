// The eval's second model: each provider gets only its own key, Meta's request is the one its docs describe,
// and the comparison page puts the models side by side. A local server stands in for Meta: no network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import {MODELS, clientOptions} from "../../scripts/lib/tag-models.js";
import {classify} from "../../scripts/lib/tag-classifier.js";
import {gradeSchool} from "../../scripts/lib/tag-eval.js";
import {buildComparison} from "../../scripts/lib/tag-compare.js";
import {PRICES, PRICES_CHECKED, costOf} from "../../scripts/lib/tag-prices.js";

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("a call's cost is its tokens at each provider's list price", () => {
  const opus = PRICES["claude-opus-5-5"], ember = PRICES["muse-ember-1.0"];
  close(costOf({input_tokens: 1_000_000, output_tokens: 100_000}, opus), 6);                 // $4 in + $2 out
  close(costOf({input_tokens: 3000, output_tokens: 500}, ember), 0.00055);                   // $0.0003 + $0.00025
  close(costOf({input_tokens: 0, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 1_000_000}, opus), 5.2);
  close(costOf({cache_read_input_tokens: 100_000, cache_creation_input_tokens: 100_000}, ember), 0.0104); // no cache-write price: input rate
  close(costOf({input_tokens: 250_000, output_tokens: 1_000_000}, ember), 0.075 + 1.5);      // over 200K: the whole call at long-context rates
  close(costOf({}, opus), 0);
  assert.equal(costOf({input_tokens: 5}, undefined), null);
});

test("every model the eval can run has a price", () => {
  for (const id of Object.keys(MODELS)) assert.ok(PRICES[id], `scripts/lib/tag-prices.js has no price for ${id}`);
  assert.match(PRICES_CHECKED, /^\d{4}-\d{2}-\d{2}$/);
});

const root = path.resolve(import.meta.dirname, "../..");
const env = {ANTHROPIC_API_KEY: "sk-ant-secret", MODEL_API_KEY: "meta-secret"};

test("each model gets its own provider's key and nothing else", () => {
  assert.deepEqual(clientOptions("claude-opus-5-5", env), {apiKey: "sk-ant-secret"});
  assert.deepEqual(clientOptions("muse-ember-1.0", env), {baseURL: "https://api.meta.ai", authToken: "meta-secret"});
  assert.throws(() => clientOptions("muse-ember-1.0", {ANTHROPIC_API_KEY: "sk-ant-secret"}), /no Meta API key: set MODEL_API_KEY/);
  assert.throws(() => clientOptions("gpt-9", env), /unknown model/);
});

test("the request to Meta carries the Meta key as a bearer token, never the Anthropic key", async () => {
  let seen;
  const answer = {music: {answer: false, quotes: [], reason: "none"}, arts: {answer: false, quotes: [], reason: "none"}, stem: {answer: false, quotes: [], reason: "none"}};
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", c => body += c).on("end", () => {
      seen = {url: req.url, headers: req.headers, body: JSON.parse(body)};
      res.writeHead(200, {"content-type": "application/json"});
      res.end(JSON.stringify({id: "msg_1", type: "message", role: "assistant", model: "muse-ember-1.0", stop_reason: "end_turn", stop_sequence: null,
        content: [{type: "text", text: JSON.stringify(answer)}], usage: {input_tokens: 5, output_tokens: 3}}));
    });
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const saved = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "sk-ant-secret"; // as it is when the launcher already set it for a Claude run
  try {
    const opts = {...clientOptions("muse-ember-1.0", env), baseURL: `http://127.0.0.1:${server.address().port}`};
    const run = await classify(new Anthropic({...opts, maxRetries: 0}), "== source ==\nNothing here.\n", {model: "muse-ember-1.0"});
    assert.equal(seen.url, "/v1/messages");
    assert.equal(seen.headers.authorization, "Bearer meta-secret");
    assert.equal(seen.headers["x-api-key"], undefined);
    assert.ok(!JSON.stringify(seen.headers).includes("sk-ant-secret"));
    assert.equal(seen.body.model, "muse-ember-1.0");
    assert.equal(seen.body.output_config.format.type, "json_schema"); // Meta's Messages endpoint takes output_config.format
    assert.deepEqual(seen.body.thinking, {type: "adaptive"});
    assert.deepEqual(run.answer, answer);
    assert.equal(run.model, "muse-ember-1.0");
  } finally {
    server.close();
    if (saved === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = saved;
  }
});

test("every model has its own run folder, approval record, and a matching entry in the double-click launcher", () => {
  const ps = fs.readFileSync(path.join(root, "scripts/run-tag-eval.ps1"), "utf8");
  const flows = Object.values(MODELS).map(m => m.flow);
  assert.equal(new Set(flows).size, flows.length);
  for (const [id, m] of Object.entries(MODELS)) {
    assert.ok(ps.includes(`"${id}"`) && ps.includes(`Flow = "${m.flow}"`) && ps.includes(`KeyEnv = "${m.keyEnv}"`), `run-tag-eval.ps1 is out of step with tag-models.js for ${id}`);
    const st = JSON.parse(fs.readFileSync(path.join(root, m.flow, "_state.json"), "utf8"));
    assert.ok(st.harness_paths.includes("scripts/lib/tag-models.js"), `${m.flow}/_state.json doesn't watch tag-models.js`);
  }
});

test("the comparison page puts the models side by side and lists where they answer differently", () => {
  const SOURCE = "== review ==\nIt has a marching band.\n";
  const cases = [{id: "20K001", school: "JHS 1", expected: {music: true, arts: false, stem: false}},
                 {id: "20K002", school: "JHS <2>", expected: {music: false, arts: false, stem: false}}];
  const yes = {answer: true, quotes: ["It has a marching band."], reason: "named"}, no = {answer: false, quotes: [], reason: "not named"};
  const row = (id, rep, answer, model) => ({prompt_id: id, rep, model, latency_s: 2, usage: {input_tokens: 100, output_tokens: 10},
    ...gradeSchool(cases.find(c => c.id === id).expected, answer, SOURCE)});
  const claude = [0, 1, 2].flatMap(r => [row("20K001", r, {music: yes, arts: no, stem: no}, "a"), row("20K002", r, {music: no, arts: no, stem: no}, "a")]);
  const ember = [0, 1, 2].flatMap(r => [row("20K001", r, {music: r ? yes : no, arts: no, stem: no}, "b"), row("20K002", r, {music: no, arts: no, stem: no}, "b")]);
  const raw = buildComparison({cases, runs: [{label: "Claude", variant: "v2", rows: claude, price: PRICES["claude-opus-5-5"]},
                                             {label: "Ember", variant: "baseline", rows: ember, price: PRICES["muse-ember-1.0"]}]});
  const html = raw.replace(/<style>[\s\S]*?<\/style>/, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  // 6 calls of 100 in, 10 out: Claude 6 × (0.0004 + 0.0002) = $0.0036; Ember 6 × (0.00001 + 0.000005) = $0.00009.
  assert.match(html, /Estimated cost of this run \$0\.0036 \$0\.00009 /);
  assert.match(html, /Estimated cost per school \(one run\) \$0\.0018 \$0\.000045 /);
  assert.match(raw, /<td class="num best">\$0\.00009<\/td>/); // the cheaper one is marked
  assert.match(html, new RegExp(`list prices checked on ${PRICES_CHECKED} \\(Claude: claude\\.com ?; Ember: dev\\.meta\\.ai ?\\)`));
  assert.match(html, /2 schools · Claude: 6 runs · Ember: 6 runs/);
  assert.match(html, /Answers right 100% 94%/);
  assert.match(html, /Answers that changed between runs 0 1/);
  assert.match(html, /Where the models answer differently \(1\)/);
  assert.match(html, /JHS 1 20K001 Music &amp; band yes yes yes in 2 of 3/);
  assert.doesNotMatch(html, /JHS <2>/); // school names are escaped
});
