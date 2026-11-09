// An in-memory stand-in for Supabase, shared by every page in a test, so two browser contexts act like
// two devices signed in to the same account. The app uses it through window.__plannerTestBackend.
// A "sign-in link" is just /#access_token=fake&uid=<id>&email=<email>.

const KEYS = {saved_schools: "dbn", visits: "event_id", step_progress: "step_id", school_notes: "dbn"};
const DEFAULT_PLAN = {home: "", max_miles: 1.5, need_subway: false, skip_competitive: false,
  weights: {distance: 2, scores: 1, safety: 2, bullying: 1, teachers: 1}, programs: []};

export function fakeServer() {
  const server = {outbox: [], plans: {}, byUser: {}, sessions: {}, failSaves: false, saves: 0};
  server.handle = (op, ...args) => {
    if (op === "sendLink") { server.outbox.push(args[0]); return null; }
    if (op === "openPlan") {
      const [uid] = args;
      if (!server.byUser[uid]) {
        const id = "plan-" + uid;
        server.byUser[uid] = id;
        server.plans[id] = {plan: {...DEFAULT_PLAN}, ...Object.fromEntries(Object.keys(KEYS).map(t => [t, []]))};
      }
      return server.byUser[uid];
    }
    if (op === "load") return structuredClone(server.plans[args[0]]);
    if (op === "loadSession") return server.sessions[args[0]] ?? null;
    if (op === "saveSession") { const {user_id, ...row} = args[0]; server.sessions[user_id] = {...row, updated_at: new Date().toISOString()}; return null; }
    if (op === "save") {
      if (server.failSaves) throw new Error("network down");
      const [id, d] = args, p = server.plans[id];
      if (d.plan) Object.assign(p.plan, d.plan);
      for (const [t, rows] of Object.entries(d.upsert)) for (const r of rows) {
        const i = p[t].findIndex(x => x[KEYS[t]] === r[KEYS[t]]);
        if (i < 0) p[t].push(r); else p[t][i] = r;
      }
      for (const [t, keys] of Object.entries(d.remove)) p[t] = p[t].filter(x => !keys.includes(x[KEYS[t]]));
      server.saves++;
      return null;
    }
    throw new Error("unknown op " + op);
  };
  return server;
}

export async function useFakeBackend(context, server) {
  await context.exposeFunction("__fakeServer", async (op, args) => {
    try { return {ok: server.handle(op, ...args)}; } catch (e) { return {error: e.message}; }
  });
  await context.addInitScript(() => {
    const call = async (op, ...args) => { const r = await window.__fakeServer(op, args); if (r.error) throw new Error(r.error); return r.ok; };
    let listener = () => {}, uid = null;
    const read = () => { try { return JSON.parse(localStorage.getItem("fake-session")); } catch { return null; } };
    window.__plannerTestBackend = {
      async session() {
        const h = new URLSearchParams(location.hash.slice(1));
        if (h.get("access_token") === "fake") { // arriving from a sign-in link
          localStorage.setItem("fake-session", JSON.stringify({user: {id: h.get("uid"), email: h.get("email")}}));
          history.replaceState(null, "", location.pathname);
        }
        const s = read(); uid = s?.user.id ?? null; return s;
      },
      onChange(cb) { listener = cb; },
      sendLink: email => call("sendLink", email),
      async signOut() { localStorage.removeItem("fake-session"); uid = null; },
      openPlan: () => call("openPlan", uid),
      load: id => call("load", id),
      save: (id, d) => call("save", id, d),
      loadSession: () => call("loadSession", uid),
      saveSession: row => call("saveSession", row),
    };
    window.__fakeAuthEvent = (event, session) => listener(event, session);
  });
}
