// Builds the page that puts two or more models' tag eval runs side by side: one self-contained HTML string.
// No files, no network: scripts/eval-tags-compare.js reads each model's latest run and writes the page.
// Everything that came from a school's page or from a model is escaped: it is web content, not trusted.
import {PROSE_TAGS} from "./tag-rules.js";
import {summarize} from "./tag-eval.js";
import {usage} from "./tag-runs.js";
import {LABEL} from "./tag-report.js";
import {PRICES_CHECKED, costOf} from "./tag-prices.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const pct = v => v == null ? "n/a" : Math.round(v * 100) + "%";
const yn = b => b ? "yes" : "no";
const num = n => n.toLocaleString("en-US");
const median = xs => { const s = xs.filter(x => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };

// One model's answer for a school and tag across its runs, in words.
function said(rows, id, t) {
  const a = rows.filter(r => r.prompt_id === id).map(r => r.answers[t]);
  const yes = a.filter(Boolean).length;
  return {yes, runs: a.length, text: !a.length ? "not run" : yes === a.length ? "yes" : yes === 0 ? "no" : `yes in ${yes} of ${a.length}`};
}

// Dollars: cents from $1 up; below that two significant figures, so a run costing a fraction of a cent still shows.
const money = v => v == null ? "no price" : v >= 1 || v === 0 ? `$${v.toFixed(2)}` : `$${Number(v.toPrecision(2))}`;

// The numbers for one model's run, against the golden answers, over the schools every model ran.
// price: the model's entry in tag-prices.js, for the estimated cost.
export function scoreRun(rows, cases, price) {
  const {tags, flips, misses} = summarize(rows, cases);
  const right = PROSE_TAGS.reduce((n, t) => n + tags[t].tp + tags[t].tn, 0);
  const cost = price ? rows.reduce((sum, r) => sum + costOf(r.usage, price), 0) : null;
  return {
    cost, costPerSchool: cost != null && cases.length ? cost / cases.length : null,
    tags, flips: flips.length, misses: misses.length,
    answersRight: rows.length ? right / (rows.length * PROSE_TAGS.length) : null,
    allThree: rows.length ? rows.filter(r => r.grade?.correct === 1).length / rows.length : null,
    quotesOk: rows.length ? rows.filter(r => r.grade?.quotes_ok === 1).length / rows.length : null,
    latency: median(rows.map(r => r.latency_s)), ...usage(rows),
  };
}

const CSS = `:root{--bg:#fff;--fg:#1b1f24;--muted:#5c6570;--line:#d9dee4;--soft:#f4f6f8;--ok:#1a7f4b;--bad:#b3261e;--warn:#8a5a00}
@media (prefers-color-scheme:dark){:root{--bg:#14171a;--fg:#e6e9ec;--muted:#9aa4af;--line:#30363d;--soft:#1c2126;--ok:#57c38a;--bad:#ff8a80;--warn:#e3b341}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,Segoe UI,sans-serif}
main{max-width:980px;margin:0 auto;padding:24px 16px 64px}h1{font-size:1.6rem;margin:0 0 4px}h2{font-size:1.2rem;margin:36px 0 8px;padding-top:16px;border-top:1px solid var(--line)}
.muted{color:var(--muted);font-weight:400}.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%}
th,td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--line);white-space:nowrap}th{font-size:.85rem;color:var(--muted)}td.num{font-variant-numeric:tabular-nums}
td.off{color:var(--bad);font-weight:600}td.best{color:var(--ok);font-weight:600}p{margin:6px 0}.none{background:var(--soft);border-radius:8px;padding:14px 16px}`;

// runs: [{label, model, variant, rows, price}], one per model (price: its tag-prices.js entry, or none), each that model's latest run. cases: the golden
// answers. generated: a date string for the header. Only schools every model ran are compared.
export function buildComparison({runs, cases: all, generated = ""}) {
  const cases = all.filter(c => runs.every(run => run.rows.some(r => r.prompt_id === c.id)));
  const ids = new Set(cases.map(c => c.id));
  const scoped = runs.map(run => ({...run, rows: run.rows.filter(r => ids.has(r.prompt_id))}));
  const scores = scoped.map(run => scoreRun(run.rows, cases, run.price));
  const head = `<tr><th></th>${scoped.map(r => `<th>${esc(r.label)} <span class="muted">(${esc(r.variant)})</span></th>`).join("")}</tr>`;
  // A row of the summary table; best marks the highest (or lowest, for counts of mistakes) when they differ.
  const line = (name, vals, fmt, best) => {
    const known = vals.filter(v => v != null);
    const top = best && known.length === vals.length && new Set(vals).size > 1 ? (best === "high" ? Math.max(...vals) : Math.min(...vals)) : null;
    return `<tr><td>${name}</td>${vals.map(v => `<td class="num${v === top ? " best" : ""}">${fmt(v)}</td>`).join("")}</tr>`;
  };
  const summary = `<div class="scroll"><table>${head}
    ${line("Answers right", scores.map(s => s.answersRight), pct, "high")}
    ${line("Schools with all three right", scores.map(s => s.allThree), pct, "high")}
    ${PROSE_TAGS.map(t => line(`${esc(LABEL[t])}: right`, scores.map(s => s.tags[t].accuracy), pct, "high")).join("")}
    ${PROSE_TAGS.map(t => line(`${esc(LABEL[t])}: wrong yes / wrong no`, scores.map(s => `${s.tags[t].fp} / ${s.tags[t].fn}`), String)).join("")}
    ${line("Answers that changed between runs", scores.map(s => s.flips), String, "low")}
    ${line("Answers the same every run, not ours", scores.map(s => s.misses), String, "low")}
    ${line("Calls whose quotes were all found word for word", scores.map(s => s.quotesOk), pct, "high")}
    ${line("Typical time per call", scores.map(s => s.latency), v => v == null ? "n/a" : `${v.toFixed(1)} s`)}
    ${line("Tokens in", scores.map(s => s.in), num)}
    ${line("Tokens out", scores.map(s => s.out), num)}
    ${line("Estimated cost of this run", scores.map(s => s.cost), money, "low")}
    ${line("Estimated cost per school (one run)", scores.map(s => s.costPerSchool), money, "low")}
  </table></div>
  <p class="muted">Counted per run, so a school answered wrong in all runs counts once per run. "Typical" is the median. Green marks the better number where the models differ.</p>
  <p class="muted">Cost is estimated from the tokens each call reported and list prices checked on ${esc(PRICES_CHECKED)} (${
    scoped.map(r => r.price ? `${esc(r.label)}: <a href="${esc(r.price.source)}" rel="noopener noreferrer">${esc(new URL(r.price.source).hostname)}</a>` : `${esc(r.label)}: no price on file`).join("; ")
  }). It counts scored calls only: failed calls (see each model's page) aren't included. Check the providers' pages, because prices change.</p>`;

  const differ = [];
  for (const c of cases) for (const t of PROSE_TAGS) {
    const s = scoped.map(run => said(run.rows, c.id, t));
    if (new Set(s.map(x => x.text)).size > 1)
      differ.push(`<tr><td>${esc(c.school)} <span class="muted">${esc(c.id)}</span></td><td>${esc(LABEL[t])}</td><td>${yn(c.expected[t])}</td>${
        s.map(x => { const off = !(x.yes === 0 || x.yes === x.runs) || (x.yes > 0) !== c.expected[t]; return `<td${off ? ' class="off"' : ""}>${x.text}</td>`; }).join("")}</tr>`);
  }
  const disagree = differ.length
    ? `<div class="scroll"><table><tr><th>School</th><th>Tag</th><th>Ours</th>${scoped.map(r => `<th>${esc(r.label)}</th>`).join("")}</tr>${differ.join("")}</table></div>
       <p class="muted">Red: not our answer, or not the same every run. Each model's own results page has its quotes and reasons for these.</p>`
    : `<p class="none">The models gave the same answers for every school and tag.</p>`;

  const missing = all.length - cases.length;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tag eval: models compared</title><style>${CSS}</style></head><body><main>
<h1>Tag eval: models compared</h1>
<p class="muted">${esc(generated)}${generated ? " · " : ""}${cases.length} schools · ${scoped.map(r => `${esc(r.label)}: ${r.rows.length} runs`).join(" · ")}${missing ? ` · ${missing} school(s) left out because not every model ran them` : ""}</p>
<p class="muted">Both are scored against today's golden answers (tests/evals/tag-cases.json), with the same prompt, rules and source text.</p>
<section><h2>Side by side</h2>${summary}</section>
<section><h2>Where the models answer differently${differ.length ? ` (${differ.length})` : ""}</h2>${disagree}</section>
</main></body></html>`;
}
