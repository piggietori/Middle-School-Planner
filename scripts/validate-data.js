// Check data/*.json. Usage: node scripts/validate-data.js [--base <git-ref>]
// With --base, also checks that no school, event, neighborhood or step ID that plans may reference was removed.
import {execFileSync} from "node:child_process";
import path from "node:path";
import {checkData, loadData, FILES} from "./lib/data-checks.js";

const root = path.resolve(import.meta.dirname, "..");
const i = process.argv.indexOf("--base"), ref = i > 0 ? process.argv[i + 1] : null;

function fromGit(f) {
  try { return JSON.parse(execFileSync("git", ["show", `${ref}:data/${f}.json`], {cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]})); }
  catch { return null; } // not on the base branch yet
}
const base = ref ? Object.fromEntries(FILES.map(f => [f, fromGit(f)])) : null;
const {errors, warnings} = checkData(loadData(path.join(root, "data")), {base});

const gh = !!process.env.GITHUB_ACTIONS;
for (const w of warnings) console.log(gh ? `::warning title=Data check::${w}` : `warning: ${w}`);
for (const e of errors) console.log(gh ? `::error title=Data check::${e}` : `error: ${e}`);
console.log(`${errors.length} errors, ${warnings.length} warnings${ref ? ` (compared with ${ref})` : ""}`);
process.exit(errors.length ? 1 : 0);
