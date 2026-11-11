// Security evals for the database: run the real migrations in Postgres (PGlite) and try to reach
// other households' data as different people. Supabase's auth schema and roles are stubbed the way
// Supabase sets them up. authenticated gets only what the migrations grant (newer projects grant nothing by default).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {PGlite} from "@electric-sql/pglite";

const dir = path.resolve(import.meta.dirname, "../../supabase/migrations");
const A = "00000000-0000-4000-8000-00000000000a", B = "00000000-0000-4000-8000-00000000000b", C = "00000000-0000-4000-8000-00000000000c";

const SUPABASE_STUB = `
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(current_setting('request.jwt.claim.sub', true), (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon; -- worst case for anon; authenticated gets only what migrations grant
  alter default privileges in schema public grant all on functions to anon;
  insert into auth.users values ('${A}', 'a@test.local'), ('${B}', 'b@test.local'), ('${C}', 'c@test.local');`;

const db = new PGlite();
await db.exec(SUPABASE_STUB);
for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));

async function as(user) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', $1, false)", [user ? JSON.stringify({sub: user, role: "authenticated"}) : ""]);
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
}
const rows = async (sql, params) => (await db.query(sql, params)).rows;
const count = async (sql, params) => (await db.query(sql, params)).affectedRows;
const denied = (p, code = "42501") => assert.rejects(p, e => e.code === code, `expected error ${code}`);

await as(A);
const planA = (await rows("select public.open_plan('2027') as id"))[0].id;
await db.query("insert into public.saved_schools (plan_id, dbn, rank) values ($1, '20K187', 1)", [planA]);
await db.query("insert into public.school_notes (plan_id, dbn, rating, pros) values ($1, '20K187', 4, '{lab}')", [planA]);
await as(B);
const planB = (await rows("select public.open_plan('2027') as id"))[0].id;

test("open_plan creates one household and plan per person and returns the same plan every time", async () => {
  await as(A);
  assert.equal((await rows("select public.open_plan('2027') as id"))[0].id, planA);
  assert.equal((await rows("select count(*)::int as n from public.households"))[0].n, 1);
  assert.deepEqual(await rows("select role from public.household_members"), [{role: "owner"}]);
  assert.notEqual(planA, planB);
});

test("a person sees only their own household's plan and rows", async () => {
  await as(B);
  assert.deepEqual(await rows("select id from public.plans"), [{id: planB}]);
  assert.deepEqual(await rows("select * from public.saved_schools where plan_id = $1", [planA]), []);
  assert.deepEqual(await rows("select * from public.school_notes"), []);
  assert.equal((await rows("select count(*)::int as n from public.households"))[0].n, 1);
});

test("a person can't change or delete another household's rows", async () => {
  await as(B);
  assert.equal(await count("update public.plans set home = 'boro' where id = $1", [planA]), 0);
  assert.equal(await count("update public.saved_schools set rank = 9 where plan_id = $1", [planA]), 0);
  assert.equal(await count("delete from public.saved_schools where plan_id = $1", [planA]), 0);
  await as(A);
  assert.deepEqual(await rows("select dbn, rank from public.saved_schools"), [{dbn: "20K187", rank: 1}]);
});

test("a person can't add rows to another household's plan", async () => {
  await as(B);
  await denied(db.query("insert into public.saved_schools (plan_id, dbn, rank) values ($1, '20K201', 2)", [planA]));
  await denied(db.query("insert into public.visits (plan_id, event_id, going) values ($1, 'k-close', true)", [planA]));
  await db.query("insert into public.saved_schools (plan_id, dbn, rank) values ($1, '20K030', 1)", [planB]);
  await denied(db.query("update public.saved_schools set plan_id = $1 where plan_id = $2", [planA, planB])); // moving a row into A's plan
});

test("nobody can join a household by inserting themselves, or create a plan for one", async () => {
  await as(A);
  const [{household_id: hA}] = await rows("select household_id from public.plans where id = $1", [planA]);
  await as(B);
  await denied(db.query("insert into public.household_members (household_id, user_id) values ($1, $2)", [hA, B]));
  await denied(db.query("insert into public.plans (household_id, cycle) values ($1, '2028')", [hA]));
  await denied(db.query("insert into public.households (name) values ('mine')"));
});

test("a second member of the same household shares the plan", async () => {
  await as(A);
  const [{household_id: hA}] = await rows("select household_id from public.plans where id = $1", [planA]);
  await as(null); await db.exec("reset role"); // as the database owner, the way an invite will add someone
  await db.query("insert into public.household_members (household_id, user_id) values ($1, $2)", [hA, C]);
  await as(C);
  assert.equal((await rows("select public.open_plan('2027') as id"))[0].id, planA);
  assert.deepEqual(await rows("select dbn from public.saved_schools"), [{dbn: "20K187"}]);
  assert.equal(await count("update public.school_notes set rating = 5 where plan_id = $1", [planA]), 1);
});

test("signed-out visitors can't read anything or open a plan", async () => {
  await as(null);
  for (const t of ["households", "household_members", "plans", "saved_schools", "visits", "step_progress", "school_notes", "user_session", "events", "client_errors", "feedback"])
    await denied(db.query(`select * from public.${t}`));
  await denied(db.query("select public.open_plan('2027')"));
  await denied(db.query("insert into public.events (name) values ('app_open')"));
  await denied(db.query("select public.delete_my_account()"));
});

test("each person reads and writes only their own session", async () => {
  await as(A);
  await db.query("insert into public.user_session (last_tab, last_dbn) values ('find', '20K187')");
  await as(B);
  assert.deepEqual(await rows("select * from public.user_session"), []);
  await denied(db.query("insert into public.user_session (user_id, last_tab) values ($1, 'home')", [A]));
  await as(A);
  assert.deepEqual(await rows("select last_tab, last_dbn from public.user_session"), [{last_tab: "find", last_dbn: "20K187"}]);
  // what the app sends: an upsert on user_id (insert the first time, update after)
  await db.query("insert into public.user_session (user_id, last_tab, last_dbn) values ($1, $2, null) on conflict (user_id) do update set last_tab = excluded.last_tab, last_dbn = excluded.last_dbn", [A, "list"]);
  assert.deepEqual(await rows("select last_tab, last_dbn from public.user_session"), [{last_tab: "list", last_dbn: null}]);
});

test("bad values are rejected by the database", async () => {
  await as(A);
  await denied(db.query("insert into public.saved_schools (plan_id, dbn, rank) values ($1, 'DROP', 1)", [planA]), "23514");
  await denied(db.query("insert into public.school_notes (plan_id, dbn, rating) values ($1, '20K201', 9)", [planA]), "23514");
  await denied(db.query("select public.open_plan('next year')"), "22023");
});

test("people can add their own events and errors, but not as someone else, and nobody can read them back", async () => {
  await as(A);
  await db.query("insert into public.events (user_id, name, props) values ($1, 'school_saved', '{\"dbn\": \"20K187\"}')", [A]);
  await db.query("insert into public.client_errors (user_id, message, context) values ($1, 'boom', 'render')", [A]);
  await denied(db.query("insert into public.events (user_id, name) values ($1, 'app_open')", [B]));
  await denied(db.query("insert into public.events (user_id, name) values (null, 'app_open')"));
  await denied(db.query("select * from public.events"));
  await denied(db.query("select * from public.client_errors"));
  await denied(db.query("update public.events set name = 'app_open'"));
  await denied(db.query("insert into public.events (user_id, name) values ($1, 'anything')", [A]), "23514");
});

test("deleting an account removes the person, and their household only if nobody else is in it", async () => {
  const D = "00000000-0000-4000-8000-00000000000d";
  await db.exec("reset role");
  await db.query("insert into auth.users values ($1, 'd@test.local')", [D]);
  await as(D);
  const planD = (await rows("select public.open_plan('2027') as id"))[0].id;
  await db.query("insert into public.saved_schools (plan_id, dbn, rank) values ($1, '20K187', 1)", [planD]);
  await db.query("insert into public.user_session (last_tab) values ('list')");
  await db.query("insert into public.events (user_id, name) values ($1, 'app_open')", [D]);
  await db.query("select public.delete_my_account()");

  // C shares A's household (added above): C goes, the household and its plan stay for A.
  await as(C);
  await db.query("select public.delete_my_account()");

  await db.exec("reset role");
  assert.equal((await rows("select count(*)::int as n from auth.users where id in ($1, $2)", [C, D]))[0].n, 0);
  assert.deepEqual(await rows("select id from public.plans where id = $1", [planD]), []);
  assert.deepEqual(await rows("select * from public.saved_schools where plan_id = $1", [planD]), []);
  assert.deepEqual(await rows("select * from public.user_session where user_id = $1", [D]), []);
  assert.deepEqual(await rows("select user_id from public.events where name = 'app_open'"), [{user_id: null}]);
  assert.deepEqual(await rows("select id from public.plans where id = $1", [planA]), [{id: planA}]);
  assert.deepEqual(await rows("select user_id from public.household_members where user_id in ($1, $2)", [A, C]), [{user_id: A}]);
});

test("old events and errors are pruned, and only the database owner can prune", async () => {
  await db.exec("reset role");
  await db.query("insert into public.events (user_id, name, at) values ($1, 'app_open', now() - interval '13 months'), ($1, 'step_done', now() - interval '11 months')", [A]);
  await db.query("insert into public.client_errors (user_id, message, at) values ($1, 'old', now() - interval '91 days'), ($1, 'recent', now() - interval '89 days')", [A]);
  const before = (await rows("select count(*)::int as n from public.events"))[0].n;
  assert.deepEqual((await rows("select public.prune_logs() as r"))[0].r, {errors: 1, events: 1, feedback: 0});
  assert.equal((await rows("select count(*)::int as n from public.events"))[0].n, before - 1);
  assert.deepEqual(await rows("select message from public.client_errors where message in ('old', 'recent')"), [{message: "recent"}]);
  await as(A);
  await denied(db.query("select public.prune_logs()"));
  await as(null);
  await denied(db.query("select public.prune_logs()"));
});

test("anyone can send feedback, nobody can read it back, and it's saved even when it can't be emailed", async () => {
  await as(null);
  await db.query("insert into public.feedback (kind, message, page) values ('wrong_info', 'The open house moved', 'dates')");
  await denied(db.query("select * from public.feedback"));
  await denied(db.query("update public.feedback set message = 'x'"));
  await denied(db.query("insert into public.feedback (kind, message, emailed) values ('idea', 'x', true)")); // only the database marks it sent
  await denied(db.query("insert into public.feedback (kind, message) values ('spam', 'x')"), "23514");
  await denied(db.query("insert into public.feedback (kind, message, reply_to) values ('idea', 'x', 'not an email')"), "23514");
  await denied(db.query("insert into public.feedback (kind, message) values ('idea', $1)", ["x".repeat(2001)]), "23514");
  await as(A);
  await db.query("insert into public.feedback (kind, message, reply_to) values ('problem', 'Saving failed', 'a@test.local')");
  await db.exec("reset role");
  // No Vault or pg_net here, like a project before setup: kept, not emailed.
  assert.deepEqual(await rows("select kind, emailed from public.feedback order by id"), [{kind: "wrong_info", emailed: false}, {kind: "problem", emailed: false}]);
});
