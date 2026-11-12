/* The only code that talks to Supabase. Loaded on demand, so signed-out visitors never download the library.
   Browser tests set window.__plannerTestBackend to an in-memory fake with the same methods. */
import {SUPABASE_URL, SUPABASE_KEY} from "../config.js";
import {CHILD_KEYS} from "../plan-model.js";

const TABLES = Object.keys(CHILD_KEYS);
const check = ({data, error}) => { if (error) throw error; return data; };

export async function createBackend() {
  if (window.__plannerTestBackend) return window.__plannerTestBackend;
  const {createClient} = await import("../vendor/supabase-js.js");
  // Sign-in is by the code from the email only. No PKCE, so the code works in whichever browser it's typed into.
  // detectSessionInUrl is off: a sign-in carried in the address (an emailed link, or a link made to sign this
  // device in to somebody else's account) is never accepted. See docs/security.md.
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {auth: {flowType: "implicit", detectSessionInUrl: false, persistSession: true, autoRefreshToken: true}});
  return {
    async session() { return check(await sb.auth.getSession()).session; },
    onChange(cb) { sb.auth.onAuthStateChange((event, session) => cb(event, session)); },
    // Emails the 6-digit code: the Magic Link and Confirm signup templates show {{ .Token }} and no link.
    async sendCode(email) {
      check(await sb.auth.signInWithOtp({email, options: {shouldCreateUser: true}}));
    },
    // The code from the email. On success Supabase reports SIGNED_IN through onChange.
    async verifyCode(email, token) { check(await sb.auth.verifyOtp({email, token, type: "email"})); },
    async signOut() { check(await sb.auth.signOut({scope: "local"})); }, // this device only
    async openPlan(cycle) { return check(await sb.rpc("open_plan", {p_cycle: cycle})); },
    async load(planId) {
      const [plan, ...rest] = await Promise.all([
        sb.from("plans").select("*").eq("id", planId).single(),
        ...TABLES.map(t => sb.from(t).select("*").eq("plan_id", planId)),
      ]);
      return {plan: check(plan), ...Object.fromEntries(TABLES.map((t, i) => [t, check(rest[i])]))};
    },
    async loadSession() {
      return check(await sb.from("user_session").select("last_tab, last_dbn, last_view, updated_at").maybeSingle());
    },
    async saveSession(row) { check(await sb.from("user_session").upsert(row, {onConflict: "user_id"})); },
    async log(events, errors) {
      if (events.length) check(await sb.from("events").insert(events));
      if (errors.length) check(await sb.from("client_errors").insert(errors));
    },
    async deleteAccount() { check(await sb.rpc("delete_my_account")); },
    async save(planId, d) {
      if (d.plan) check(await sb.from("plans").update(d.plan).eq("id", planId));
      for (const [t, rows] of Object.entries(d.upsert))
        check(await sb.from(t).upsert(rows.map(r => ({plan_id: planId, ...r})), {onConflict: "plan_id," + CHILD_KEYS[t]}));
      for (const [t, keys] of Object.entries(d.remove))
        check(await sb.from(t).delete().eq("plan_id", planId).in(CHILD_KEYS[t], keys));
    },
  };
}
