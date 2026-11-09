/* The only code that talks to Supabase. Loaded on demand, so signed-out visitors never download the library.
   Browser tests set window.__plannerTestBackend to an in-memory fake with the same methods. */
import {SUPABASE_URL, SUPABASE_KEY} from "../config.js";
import {CHILD_KEYS} from "../plan-model.js";

const TABLES = Object.keys(CHILD_KEYS);
const check = ({data, error}) => { if (error) throw error; return data; };

export async function createBackend() {
  if (window.__plannerTestBackend) return window.__plannerTestBackend;
  const {createClient} = await import("../vendor/supabase-js.js");
  // Implicit flow: the sign-in link carries the session, so it works even when opened on another device.
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {auth: {flowType: "implicit", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true}});
  return {
    async session() { return check(await sb.auth.getSession()).session; },
    onChange(cb) { sb.auth.onAuthStateChange((event, session) => cb(event, session)); },
    async sendLink(email) {
      check(await sb.auth.signInWithOtp({email, options: {emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true}}));
    },
    async signOut() { check(await sb.auth.signOut({scope: "local"})); }, // this device only
    async openPlan(cycle) { return check(await sb.rpc("open_plan", {p_cycle: cycle})); },
    async load(planId) {
      const [plan, ...rest] = await Promise.all([
        sb.from("plans").select("*").eq("id", planId).single(),
        ...TABLES.map(t => sb.from(t).select("*").eq("plan_id", planId)),
      ]);
      return {plan: check(plan), ...Object.fromEntries(TABLES.map((t, i) => [t, check(rest[i])]))};
    },
    async save(planId, d) {
      if (d.plan) check(await sb.from("plans").update(d.plan).eq("id", planId));
      for (const [t, rows] of Object.entries(d.upsert))
        check(await sb.from(t).upsert(rows.map(r => ({plan_id: planId, ...r})), {onConflict: "plan_id," + CHILD_KEYS[t]}));
      for (const [t, keys] of Object.entries(d.remove))
        check(await sb.from(t).delete().eq("plan_id", planId).in(CHILD_KEYS[t], keys));
    },
  };
}
