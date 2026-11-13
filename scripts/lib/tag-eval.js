// Grading for the tag classifier eval, all by code: does each answer match ours (tests/evals/tag-cases.json),
// and is every quote behind a "yes" really in the school's source text?
import {PROSE_TAGS} from "./tag-rules.js";
import {quoteFound} from "./tag-sources.js";

// expected: {music, arts, stem} booleans. answer: the classifier's {music: {answer, quotes, reason}, ...}.
// Returns the scores for one school and, in words, anything that went wrong.
export function gradeSchool(expected, answer, source) {
  const wrong = [], badQuotes = [];
  for (const t of PROSE_TAGS) {
    const d = answer[t];
    if (d.answer !== expected[t]) wrong.push(`${t}: said ${d.answer ? "yes" : "no"}, ours is ${expected[t] ? "yes" : "no"} (${d.reason})`);
    if (d.answer && !d.quotes.length) badQuotes.push(`${t}: yes with no quote`);
    for (const q of d.answer ? d.quotes : []) if (!quoteFound(source, q)) badQuotes.push(`${t}: not in the source text: "${q}"`);
  }
  return {
    grade: {correct: wrong.length ? 0 : 1, agree: (PROSE_TAGS.length - wrong.length) / PROSE_TAGS.length, quotes_ok: badQuotes.length ? 0 : 1},
    explanation: {correct: wrong.join("; ") || "all three match", agree: wrong.join("; ") || "all three match", quotes_ok: badQuotes.join("; ") || "every quote found"},
    answers: Object.fromEntries(PROSE_TAGS.map(t => [t, answer[t].answer])),
  };
}

const ratio = (a, b) => b ? a / b : null;
// rows: results.jsonl rows ({prompt_id, rep, answers}); cases: [{id, expected}].
// Per tag: precision (of the yeses it gave, how many are ours), recall (of our yeses, how many it found),
// specificity (of our nos, how many it left alone). flips: decisions that changed between runs of one school.
export function summarize(rows, cases) {
  const want = Object.fromEntries(cases.map(c => [c.id, c.expected]));
  const tags = {}, flips = [], misses = [];
  for (const t of PROSE_TAGS) {
    let tp = 0, fp = 0, tn = 0, fn = 0;
    for (const r of rows) {
      const said = r.answers[t], ours = want[r.prompt_id][t];
      if (said && ours) tp++; else if (said) fp++; else if (ours) fn++; else tn++;
    }
    tags[t] = {tp, fp, tn, fn, precision: ratio(tp, tp + fp), recall: ratio(tp, tp + fn), specificity: ratio(tn, tn + fp), accuracy: ratio(tp + tn, rows.length)};
    for (const c of cases) {
      const said = rows.filter(r => r.prompt_id === c.id).map(r => r.answers[t]);
      if (new Set(said).size > 1) flips.push({id: c.id, tag: t, yes: said.filter(Boolean).length, runs: said.length});
      else if (said.length && said[0] !== c.expected[t]) misses.push({id: c.id, tag: t, said: said[0], ours: c.expected[t]});
    }
  }
  return {tags, flips, misses, runs: rows.length};
}
