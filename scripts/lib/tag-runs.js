// The tag classifier eval's saved runs (.claude/hillclimb/tag-classifier/<run>/results.jsonl): which exist,
// and which one the next run should write to. Runs are named baseline, v1, v2, ... by the runner.
import fs from "node:fs";
import path from "node:path";

export const readJsonl = f => fs.existsSync(f) ? fs.readFileSync(f, "utf8").split("\n").filter(l => l.trim()).map(l => JSON.parse(l)) : [];
const order = v => v === "baseline" ? 0 : +v.slice(1);

// Every run folder in the flow directory, oldest first, with its scored rows.
export function listRuns(flow) {
  if (!fs.existsSync(flow)) return [];
  return fs.readdirSync(flow, {withFileTypes: true})
    .filter(d => d.isDirectory() && /^(baseline|v[1-9]\d*)$/.test(d.name))
    .map(d => ({variant: d.name, rows: readJsonl(path.join(flow, d.name, "results.jsonl"))}))
    .sort((a, b) => order(a.variant) - order(b.variant));
}

// runs: from listRuns. total: schools × runs per school. An unfinished latest run is picked up again;
// otherwise the next name in line.
export function nextRun(runs, total) {
  const last = runs.at(-1);
  if (!last) return {variant: "baseline", resume: false, done: 0};
  const done = new Set(last.rows.map(r => `${r.prompt_id}#${r.rep}`)).size;
  if (done < total) return {variant: last.variant, resume: done > 0, done};
  return {variant: `v${order(last.variant) + 1}`, resume: false, done: 0};
}

export const usage = rows => rows.reduce((a, r) => ({in: a.in + (r.usage?.input_tokens ?? 0), out: a.out + (r.usage?.output_tokens ?? 0)}), {in: 0, out: 0});
