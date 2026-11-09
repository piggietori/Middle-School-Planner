// Security evals for the database: run the real migrations in Postgres (PGlite) and try to reach
// other households' data as different people. Supabase's auth schema and roles are stubbed the way
// Supabase sets them up, including its default grants to anon and authenticated.
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
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
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
  for (const t of ["households", "household_members", "plans", "saved_schools", "visits", "step_progress", "school_notes", "user_session"])
    await denied(db.query(`select * from public.${t}`));
  await denied(db.query("select public.open_plan('2027')"));
});

test("each person reads and writes only their own session", async () => {
  await as(A);
  await db.query("insert into public.user_session (last_tab, last_dbn) values ('find', '20K187')");
  await as(B);
  assert.deepEqual(await rows("select * from public.user_session"), []);
  await denied(db.query("insert into public.user_session (user_id, last_tab) values ($1, 'home')", [A]));
  await as(A);
  assert.deepEqual(await rows("select last_tab, last_dbn from public.user_session"), [{last_tab: "find", last_dbn: "20K187"}]);
});

test("bad values are rejected by the database", async () => {
  await as(A);
  await denied(db.query("insert into public.saved_schools (plan_id, dbn, rank) values ($1, 'DROP', 1)", [planA]), "23514");
  await denied(db.query("insert into public.school_notes (plan_id, dbn, rating) values ($1, '20K201', 9)", [planA]), "23514");
  await denied(db.query("select public.open_plan('next year')"), "22023");
});
