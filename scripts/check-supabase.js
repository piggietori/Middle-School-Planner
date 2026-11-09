// Check the live Supabase project from the outside, as a signed-out visitor would see it:
// every table and the open_plan function must refuse. Run after applying a migration:
//   node scripts/check-supabase.js
import {SUPABASE_URL, SUPABASE_KEY} from "../src/config.js";

const TABLES = ["households", "household_members", "plans", "saved_schools", "visits", "step_progress", "school_notes", "user_session"];
const headers = {apikey: SUPABASE_KEY, "content-type": "application/json"};
let failed = 0;
const report = (ok, what, detail) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}: ${detail}`); if (!ok) failed++; };

for (const t of TABLES) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${t}?select=*&limit=1`, {headers});
  const body = await res.text();
  // 401/403 = refused. 404 = the table doesn't exist (migration not applied). 200 = readable, which must never happen.
  report(res.status === 401 || res.status === 403, `read ${t}`, res.status === 404 ? "404, table missing: apply the migration" : `${res.status} ${body.slice(0, 80)}`);
}
const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/open_plan`, {method: "POST", headers, body: JSON.stringify({p_cycle: "2027"})});
report(rpc.status === 401 || rpc.status === 403, "call open_plan", rpc.status === 404 ? "404, function missing: apply the migration" : `${rpc.status} ${(await rpc.text()).slice(0, 80)}`);
const auth = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {headers});
const s = await auth.json();
report(s.external?.email === true, "email sign-in enabled", String(s.external?.email));
report(s.external?.anonymous_users === false, "anonymous sign-ins off", String(s.external?.anonymous_users));
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
