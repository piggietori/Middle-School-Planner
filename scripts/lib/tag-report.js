// Builds the tag classifier eval's results page: one self-contained HTML string from a run's saved rows.
// No files, no network: scripts/eval-tags-report.js reads the inputs and writes the page.
// Everything that came from a school's page or from the model is escaped: it is web content, not trusted.
import {PROSE_TAGS} from "./tag-rules.js";
import {summarize} from "./tag-eval.js";
import {usage} from "./tag-runs.js";

export const LABEL = {music: "Music & band", arts: "Arts", stem: "Science & tech"};
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const pct = v => v == null ? "n/a" : Math.round(v * 100) + "%";
const L = t => esc(LABEL[t]);
const yn = b => b ? "yes" : "no";
const num = n => n.toLocaleString("en-US");

// What the classifier said for one school and tag across a run's repeats.
function said(rows, id, t) {
  const a = rows.filter(r => r.prompt_id === id).map(r => r.answers[t]);
  const yes = a.filter(Boolean).length;
  return {yes, runs: a.length, steady: yes === 0 || yes === a.length,
          text: !a.length ? "not run" : yes === a.length ? "yes" : yes === 0 ? "no" : `yes in ${yes} of ${a.length} runs`};
}

// Our answer at the time a row was scored, read back from what the grader recorded (gradeSchool in
// tag-eval.js writes "<tag>: said ..." for each answer that differed). Lets a later page show which of
// our answers have changed since.
export const oursThen = (row, t) => row.explanation?.correct?.includes(`${t}: said `) ? !row.answers[t] : row.answers[t];

const KIND = {
  differs: {badge: "Same every run, not ours", help: "Either the model is wrong, or it found something we missed, or our rule is unclear. Read its quote. If it is right, change the tag with that quote as evidence. If it is wrong, sharpen the rule's wording."},
  flipped: {badge: "Changed between runs", help: "The text is borderline under the rule as written. Decide it yourself and record why in the case's note."},
};

function modelSide(rows, traces, id, t) {
  return rows.filter(r => r.prompt_id === id).sort((a, b) => a.rep - b.rep).map(r => {
    const d = traces[`${id}_rep${r.rep}`]?.[t];
    const quotes = d?.quotes?.length ? `<ul>${d.quotes.map(q => `<li class="quote">${esc(q)}</li>`).join("")}</ul>` : "";
    // Without the saved answer, the row still holds the reason for an answer that differed from ours.
    const kept = r.explanation?.correct?.split("; ").find(p => p.startsWith(`${t}: said `))?.match(/\((.*)\)$/)?.[1];
    const why = d ? `<p class="why">${esc(d.reason)}</p>`
      : `${kept ? `<p class="why">${esc(kept)}</p>` : ""}<p class="why muted">Quotes${kept ? " aren't" : " and reason aren't"} saved for this run on this computer.</p>`;
    return `<div class="run"><b>Run ${r.rep + 1}: ${yn(r.answers[t])}</b>${quotes}${why}</div>`;
  }).join("");
}

function ourSide(c, school, t) {
  const ev = school?.tag_evidence?.[t] ?? [];
  const link = e => /^https?:\/\//.test(e.url ?? "") ? ` <a href="${esc(e.url)}" rel="noopener noreferrer">${esc(new URL(e.url).hostname)}</a>` : "";
  return `<p><b>${yn(c.expected[t])}</b></p>`
    + (c.notes?.[t] ? `<p class="why">${esc(c.notes[t])}</p>` : "")
    + (ev.length ? `<ul>${ev.map(e => `<li class="quote">${esc(e.quote)} <span class="muted">(${esc(e.where)})</span>${link(e)}</li>`).join("")}</ul>`
                 : `<p class="muted">No stored evidence${c.expected[t] ? "" : ": the school doesn't have this tag"}.</p>`);
}

const card = (kind, c, school, t, rows, traces) => `<article class="card">
  <h3>${esc(c.school)} <span class="muted">${esc(c.id)}</span> · ${L(t)} <span class="badge ${kind}">${KIND[kind].badge}</span></h3>
  <div class="sides"><div><h4>The classifier</h4>${modelSide(rows, traces, c.id, t)}</div><div><h4>Ours</h4>${ourSide(c, school, t)}</div></div>
  <p class="help">${KIND[kind].help}</p>
</article>`;

function comparison(prev, rows, cases) {
  const both = cases.filter(c => prev.rows.some(r => r.prompt_id === c.id));
  const moved = [], golden = [];
  let then = 0, now = 0;
  for (const c of both) for (const t of PROSE_TAGS) {
    const a = said(prev.rows, c.id, t), b = said(rows, c.id, t);
    const was = oursThen(prev.rows.find(r => r.prompt_id === c.id), t), ours = c.expected[t];
    if (!a.steady || (a.yes > 0) !== was) then++;
    if (!b.steady || (b.yes > 0) !== ours) now++;
    if (was !== ours) golden.push(`<li>${esc(c.school)}, ${L(t)}: ours was <b>${yn(was)}</b>, now <b>${yn(ours)}</b></li>`);
    if (a.text !== b.text) {
      const agrees = b.steady && (b.yes > 0) === ours;
      moved.push(`<li>${esc(c.school)}, ${L(t)}: classifier said <b>${a.text}</b>, now <b>${b.text}</b> <span class="${agrees ? "ok" : "bad"}">${agrees ? "matches ours" : "doesn't match ours"}</span></li>`);
    }
  }
  return `<section><h2>Changed since ${esc(prev.variant)}</h2>
  <p>Disagreements and flipped answers: <b>${then}</b> in ${esc(prev.variant)} (against our answers at the time), <b>${now}</b> now.</p>
  <h4>The classifier's answers</h4>${moved.length ? `<ul>${moved.join("")}</ul>` : `<p class="muted">None changed.</p>`}
  <h4>Our answers</h4>${golden.length ? `<ul>${golden.join("")}</ul>` : `<p class="muted">None changed.</p>`}
  </section>`;
}

const CSS = `:root{--bg:#fff;--fg:#1b1f24;--muted:#5c6570;--line:#d9dee4;--soft:#f4f6f8;--ok:#1a7f4b;--bad:#b3261e;--warn:#8a5a00}
@media (prefers-color-scheme:dark){:root{--bg:#14171a;--fg:#e6e9ec;--muted:#9aa4af;--line:#30363d;--soft:#1c2126;--ok:#57c38a;--bad:#ff8a80;--warn:#e3b341}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,Segoe UI,sans-serif}
main{max-width:980px;margin:0 auto;padding:24px 16px 64px}h1{font-size:1.6rem;margin:0 0 4px}h2{font-size:1.2rem;margin:36px 0 8px;padding-top:16px;border-top:1px solid var(--line)}
h3{font-size:1.05rem;margin:0 0 10px}h4{font-size:.8rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin:14px 0 6px}
.muted{color:var(--muted);font-weight:400}.ok{color:var(--ok)}.bad{color:var(--bad)}a{color:inherit}
.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--line);white-space:nowrap}th{font-size:.85rem;color:var(--muted)}
.card{border:1px solid var(--line);border-radius:8px;padding:14px 16px;margin:12px 0}.sides{display:grid;grid-template-columns:1fr 1fr;gap:20px}@media (max-width:640px){.sides{grid-template-columns:1fr}}
.badge{font-size:.75rem;font-weight:600;padding:2px 8px;border-radius:999px;border:1px solid currentColor;white-space:nowrap}.badge.differs{color:var(--bad)}.badge.flipped{color:var(--warn)}
.quote{font-style:italic}.quote::before{content:"\\201C"}.quote::after{content:"\\201D"}ul{margin:6px 0;padding-left:20px}p{margin:6px 0}.why{color:var(--muted)}
.run{margin-bottom:10px}.help{background:var(--soft);border-radius:6px;padding:8px 10px;font-size:.9rem;margin-top:12px}
.none{background:var(--soft);border-radius:8px;padding:14px 16px}td.off{color:var(--bad);font-weight:600}details{border-bottom:1px solid var(--line);padding:8px 0}summary{cursor:pointer;font-weight:600}`;

// variant: this run's name. rows, errors: its results.jsonl and errors.jsonl. traces: {"<id>_rep<k>": the
// classifier's answer for that run}, where saved. cases: the golden answers. schools: data/schools.json's
// schools. prev: {variant, rows} of the run before, or null. generated: a date string for the header.
export function buildReport({variant, rows, errors = [], traces = {}, cases: all, schools = [], prev = null, generated = ""}) {
  const cases = all.filter(c => rows.some(r => r.prompt_id === c.id));
  const school = id => schools.find(s => s.dbn === id);
  const {tags, flips, misses} = summarize(rows, cases);
  const u = usage(rows);
  const issues = [...misses.map(m => ({...m, kind: "differs"})), ...flips.map(f => ({...f, kind: "flipped"}))];
  const badQuotes = rows.filter(r => r.grade?.quotes_ok !== 1);
  const byId = id => cases.find(c => c.id === id);

  const tagTable = `<div class="scroll"><table><tr><th>Tag</th><th>Right</th><th>Precision</th><th>Recall</th><th>Specificity</th><th>Wrong yes</th><th>Wrong no</th></tr>${
    PROSE_TAGS.map(t => { const m = tags[t]; return `<tr><td>${L(t)}</td><td>${pct(m.accuracy)}</td><td>${pct(m.precision)}</td><td>${pct(m.recall)}</td><td>${pct(m.specificity)}</td><td>${m.fp}</td><td>${m.fn}</td></tr>`; }).join("")
  }</table></div><p class="muted">Counted per run, so one school answered wrong in all runs counts once per run. Precision: of its yeses, how many are ours. Recall: of our yeses, how many it found. Specificity: of our nos, how many it left alone.</p>`;

  const decide = issues.length || badQuotes.length
    ? issues.map(i => card(i.kind, byId(i.id), school(i.id), i.tag, rows, traces)).join("")
      + (badQuotes.length ? `<article class="card"><h3>Quotes not found word for word in the source <span class="badge differs">Don't trust these answers</span></h3><ul>${
          badQuotes.map(r => `<li>${esc(byId(r.prompt_id).school)}, run ${r.rep + 1}: ${esc(r.explanation?.quotes_ok)}</li>`).join("")
        }</ul><p class="help">The model invented or reworded its reason. If it recurs, tighten the prompt.</p></article>` : "")
    : `<p class="none"><b class="ok">Nothing to decide.</b> Every answer matches ours in every run, and every quote was found word for word in its source.</p>`;

  const grid = `<div class="scroll"><table><tr><th>School</th>${PROSE_TAGS.map(t => `<th>${L(t)}</th>`).join("")}</tr>${
    cases.map(c => `<tr><td>${esc(c.school)}</td>${PROSE_TAGS.map(t => { const s = said(rows, c.id, t), off = !s.steady || (s.yes > 0) !== c.expected[t];
      return `<td${off ? ' class="off"' : ""}>${s.text}${off ? ` (ours: ${yn(c.expected[t])})` : ""}</td>`; }).join("")}</tr>`).join("")
  }</table></div>`;

  const detail = cases.map(c => `<details><summary>${esc(c.school)} <span class="muted">${esc(c.id)}</span></summary>${
    PROSE_TAGS.map(t => `<h4>${L(t)}</h4><div class="sides"><div>${modelSide(rows, traces, c.id, t)}</div><div>${ourSide(c, school(c.id), t)}</div></div>`).join("")
  }</details>`).join("");

  const failed = errors.length ? `<section><h2>Failed calls</h2><p>${errors.length} call(s) failed and are not counted above. They are retried the next time this run is started.</p><ul>${
    [...new Set(errors.map(e => String(e.error ?? e.failure_class).slice(0, 300)))].map(e => `<li class="muted">${esc(e)}</li>`).join("")}</ul></section>` : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tag eval: ${esc(variant)}</title><style>${CSS}</style></head><body><main>
<h1>Tag eval: ${esc(variant)}</h1>
<p class="muted">${esc(generated)}${generated ? " · " : ""}${cases.length} schools · ${rows.length} runs · ${esc([...new Set(rows.map(r => r.model))].join(", "))} · ${num(u.in)} tokens in, ${num(u.out)} out${errors.length ? ` · ${errors.length} failed call(s)` : ""}</p>
<p class="muted">Scored against today's golden answers (tests/evals/tag-cases.json). The classifier proposes; a tag changes only when you decide, through a pull request.</p>
<section><h2>Per tag</h2>${tagTable}</section>
<section><h2>Needs your decision${issues.length ? ` (${issues.length})` : ""}</h2>${decide}</section>
${prev ? comparison(prev, rows, cases) : ""}
<section><h2>Every school</h2>${grid}<h4>Quotes and reasons</h4>${detail}</section>
${failed}
</main></body></html>`;
}
