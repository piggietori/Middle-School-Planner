// Journeys J2 (sign in and keep what I did) and J3 (come back on another device). See docs/journeys.md.
// Uses an in-memory fake of the account server (fake-backend.js), shared by both "devices".
import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import {test, expect} from "@playwright/test";
import {useFixtureData} from "./fixture-data.js";
import {fakeServer, useFakeBackend} from "./fake-backend.js";

// A test shortcut that starts a page already signed in. Only the fake backend reads it (tests/e2e/fake-backend.js).
const signedInAs = (uid, email = uid + "@example.com") => `/#test_signin=1&uid=${uid}&email=${encodeURIComponent(email)}`;
const LOCAL_PLAN = JSON.stringify({home: "dyker", saved: ["20K201", "20K187"], going: ["oh-20K201-2026-11-09-1700"], attended: [], done: {s1: true, s2: true}, notes: {}});

// Each "device" is its own browser context, closed after the test so leftover pages don't slow the next one.
const contexts = [];
test.afterEach(async () => { await Promise.all(contexts.splice(0).map(c => c.close())); });

async function device(browser, server, {plan, bypassCSP = false} = {}) {
  const context = await browser.newContext({bypassCSP});
  contexts.push(context);
  await useFakeBackend(context, server);
  if (plan) await context.addInitScript(p => {
    if (location.protocol === "http:" && !localStorage.getItem("d20plan")) localStorage.setItem("d20plan", p);
  }, plan);
  const page = await context.newPage();
  await useFixtureData(page);
  await page.clock.setFixedTime(new Date("2026-11-09T10:00:00"));
  page.on("pageerror", e => { throw e; });
  return page;
}
const listNames = page => page.locator("#app .sc h3").allTextContents();
const synced = page => expect(page.locator("#acct .acct-dot")).toBeVisible();

test("sign in from a device with a plan: the plan is saved to the new account (J2)", async ({browser}) => {
  const server = fakeServer();
  const page = await device(browser, server, {plan: LOCAL_PLAN});
  await page.goto("/");
  await expect(page.getByText("Keep your plan safe:")).toBeVisible();
  await page.locator("#acct").getByRole("button", {name: "Sign in"}).click();
  await page.fill("#acct-email", "parent@example.com");
  await page.getByRole("button", {name: "Email me a code"}).click();
  await expect(page.locator("#acctsheet")).toContainText("We sent a 6-digit code to parent@example.com");
  expect(server.outbox).toEqual(["parent@example.com"]);

  await page.goto("about:blank"); // the link from the email opens as a new page load, not a hash change
  await page.goto(signedInAs("a", "parent@example.com"));
  await expect(page.locator("#toast")).toHaveText("Signed in. Your plan is saved to your account.");
  await synced(page);
  await expect(page.getByText("Keep your plan safe:")).toHaveCount(0);
  const p = server.plans[server.byUser.a];
  expect(p.saved_schools).toEqual([{dbn: "20K201", rank: 1}, {dbn: "20K187", rank: 2}]);
  expect(p.plan.home).toBe("dyker");
  expect(p.visits).toEqual([{event_id: "oh-20K201-2026-11-09-1700", going: true, attended: false}]);
});

test("another device signed in to the same account gets the plan, and changes flow both ways (J3)", async ({browser}) => {
  const server = fakeServer();
  const laptop = await device(browser, server, {plan: LOCAL_PLAN});
  await laptop.goto(signedInAs("a"));
  await synced(laptop);

  const phone = await device(browser, server);
  await phone.goto(signedInAs("a"));
  await expect(phone.locator("#toast")).toHaveText("Signed in. Your plan is loaded.");
  await phone.locator('.tab[data-tab="list"]').click();
  expect(await listNames(phone)).toEqual(["J.H.S. 201 The Madeleine Brennan School", "I.S. 187 The Christa McAuliffe School"]);

  // Change on the phone: move IS 187 to the top.
  await phone.click('[data-mv="1:-1"]');
  await expect.poll(() => server.plans[server.byUser.a].saved_schools.find(r => r.dbn === "20K187").rank).toBe(1);

  // The laptop picks it up when it comes back into view.
  await laptop.locator('.tab[data-tab="list"]').click();
  await laptop.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(laptop.locator("#app .sc h3").first()).toHaveText("I.S. 187 The Christa McAuliffe School");
});

test("signing in on another device opens where you left off: same tab, view and school (J3)", async ({browser}) => {
  const server = fakeServer();
  const laptop = await device(browser, server, {plan: LOCAL_PLAN});
  await laptop.goto(signedInAs("a"));
  await synced(laptop);
  await laptop.locator('.tab[data-tab="dates"]').click();
  await laptop.click('[data-dv="list"]');
  await laptop.locator('.tab[data-tab="find"]').click();
  await laptop.locator("#app [data-open]").first().click();
  const school = (await laptop.locator("#sheet [role=dialog]").getAttribute("aria-label"));
  await expect.poll(() => server.sessions.a?.last_dbn).toBeTruthy();
  expect(server.sessions.a).toMatchObject({last_tab: "find", last_view: null});

  const phone = await device(browser, server);
  await phone.goto(signedInAs("a"));
  await synced(phone);
  await expect(phone.locator("#sheet [role=dialog]")).toHaveAttribute("aria-label", school);
  await expect(phone.locator('.tab[data-tab="find"]')).toHaveAttribute("aria-current", "page");
  await expect(phone).toHaveURL(/#find$/);
});

test("on the same device, coming back opens the same tab, view and school; closing the school forgets it", async ({page}) => {
  await useFixtureData(page);
  await page.clock.setFixedTime(new Date("2026-11-09T10:00:00"));
  await page.goto("/");
  await page.locator('.tab[data-tab="dates"]').click();
  await page.click('[data-dv="list"]');
  await page.goto("about:blank");
  await page.goto("/"); // no tab in the address: back where we were
  await expect(page.locator('[data-dv="list"]')).toHaveAttribute("aria-pressed", "true");

  await page.locator('.tab[data-tab="find"]').click();
  await page.locator("#app [data-open]").first().click();
  await page.reload(); // address is /#find, the tab we were on: the school reopens
  await expect(page.locator("#sheet [role=dialog]")).toBeVisible();
  await page.click("#sheet button[data-close]");
  await page.reload();
  await expect(page.locator("#sheet [role=dialog]")).toHaveCount(0);

  await page.goto("about:blank");
  await page.goto("/#list"); // a link to another tab wins
  await expect(page.locator('.tab[data-tab="list"]')).toHaveAttribute("aria-current", "page");
});

test("signing in on a device that has its own plan combines it with the account (J2 merge)", async ({browser}) => {
  const server = fakeServer();
  const first = await device(browser, server, {plan: LOCAL_PLAN});
  await first.goto(signedInAs("a"));
  await synced(first);

  const other = await device(browser, server, {plan: JSON.stringify({home: "boro", saved: ["20K030"], going: [], attended: [], done: {s5: true}, notes: {}})});
  await other.goto(signedInAs("a"));
  await expect(other.locator("#toast")).toHaveText("Signed in. We added this device's plan to your account.");
  await other.locator('.tab[data-tab="list"]').click();
  expect(await listNames(other)).toEqual(["J.H.S. 201 The Madeleine Brennan School", "I.S. 187 The Christa McAuliffe School", "P.S./I.S. 30 Mary White Ovington"]);
  await expect.poll(() => server.plans[server.byUser.a].saved_schools.length).toBe(3);
  expect(server.plans[server.byUser.a].plan.home).toBe("dyker"); // the account's settings win
});

test("if saving fails, say so, keep the change on the device, and send it when back online", async ({browser}) => {
  const server = fakeServer();
  const page = await device(browser, server, {plan: LOCAL_PLAN});
  await page.goto(signedInAs("a"));
  await synced(page);
  server.failSaves = true;
  await page.locator('.tab[data-tab="find"]').click();
  const answers = page.locator(".prefs-sum");
  if (await answers.isVisible()) await answers.getByRole("button", {name: "Edit answers"}).click(); // phones fold the answers
  await page.selectOption("#home", "boro");
  await expect(page.locator("#toast")).toContainText("Couldn't save to your account. We'll keep trying.");
  await page.locator("#acct button").click();
  await expect(page.locator("#acctsheet [role=status]")).toHaveText("Couldn't save. We'll try again when you're back online.");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("d20plan")).home)).toBe("boro");

  server.failSaves = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator("#acctsheet [role=status]")).toHaveText("✓ All changes saved to your account");
  expect(server.plans[server.byUser.a].plan.home).toBe("boro");
});

test("changes made offline are combined with the account on the next visit, not thrown away", async ({browser}) => {
  const server = fakeServer();
  const page = await device(browser, server, {plan: LOCAL_PLAN});
  await page.goto(signedInAs("a"));
  await synced(page);
  server.failSaves = true;
  await page.locator('.tab[data-tab="find"]').click();
  await page.locator("#app .sc").filter({hasText: "P.S./I.S. 30"}).getByRole("button", {name: "☆ Save"}).click();
  await expect(page.locator("#toast")).toContainText("Couldn't save");
  server.failSaves = false;
  await page.reload();
  await synced(page);
  await expect.poll(() => server.plans[server.byUser.a].saved_schools.map(r => r.dbn)).toEqual(["20K201", "20K187", "20K030"]);
});

test("a link from an older email explains that sign-in is by code now", async ({browser}) => {
  const page = await device(browser, fakeServer());
  await page.goto("/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  await expect(page.locator("#acctsheet [role=alert]")).toHaveText("That sign-in link has expired. The planner now signs in with a code: send yourself a new email and type the code from it. Still stuck? Tell us");
  await expect(page.locator("#acct-email")).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
});

// Sign-in is by code only. A link that carries a sign-in could be made by someone else, to sign this device in to
// their account and collect the plan that's on it (F-65).
test("a link that carries a sign-in is refused: the device stays signed out and keeps its plan (F-65)", async ({browser}) => {
  const server = fakeServer();
  const page = await device(browser, server, {plan: LOCAL_PLAN});
  await page.goto("/#access_token=someone-elses&refresh_token=r&expires_in=3600&expires_at=1999999999&token_type=bearer&type=magiclink");
  await expect(page.locator("#acctsheet [role=alert]")).toContainText("The planner now signs in with a code");
  await expect(page.locator("#acct-email")).toBeVisible();
  await expect(page.locator("#acct")).toHaveText("Sign in");
  expect(new URL(page.url()).hash).toBe("");
  expect(Object.keys(server.byUser)).toEqual([]); // nobody's account was opened, so nothing was merged into one
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("d20plan")).saved)).toEqual(["20K201", "20K187"]);
});

test("the code from the email signs in, and a wrong one is explained (F-11)", async ({browser}) => {
  const server = fakeServer();
  const page = await device(browser, server, {plan: LOCAL_PLAN});
  await page.emulateMedia({reducedMotion: "reduce"}); // check the sheet as it settles, not mid slide-in
  await page.goto("/");
  await page.locator("#acct").getByRole("button", {name: "Sign in"}).click();
  await page.fill("#acct-email", "parent@example.com");
  await page.getByRole("button", {name: "Email me a code"}).click();
  await expect(page.locator("#acctsheet")).toContainText("We sent a 6-digit code to parent@example.com");
  expect((await new AxeBuilder({page}).analyze()).violations.filter(v => ["serious", "critical"].includes(v.impact)).map(v => `${v.id}: ${v.nodes.map(n => n.target.join(" ")).join(", ")}`)).toEqual([]);

  // Too short, then wrong: explained, and the code box keeps what was typed.
  await page.fill("#acct-code", "123");
  await page.locator("#acctsheet").getByRole("button", {name: "Sign in", exact: true}).click();
  await expect(page.locator("#acctsheet [role=alert]")).toContainText("Type the code from the email: it's 6 digits.");
  await page.fill("#acct-code", "111 111");
  await page.locator("#acctsheet").getByRole("button", {name: "Sign in", exact: true}).click();
  await expect(page.locator("#acctsheet [role=alert]")).toContainText("That code didn't work or has expired.");
  await expect(page.locator("#acct-code")).toHaveValue("111 111");

  // The right code (spaces are fine): signed in, and this device's plan is saved to the new account.
  await page.fill("#acct-code", "246 810");
  await page.locator("#acctsheet").getByRole("button", {name: "Sign in", exact: true}).click();
  await expect(page.locator("#toast")).toHaveText("Signed in. Your plan is saved to your account.");
  await synced(page);
  await expect.poll(() => server.plans[server.byUser.parent]?.saved_schools.map(r => r.dbn)).toEqual(["20K201", "20K187"]);
  await expect.poll(() => server.events.find(e => e.name === "sign_in")?.props).toEqual({method: "code", claimed_local: true}); // sent in a batch
  expect(server.codes).toEqual({}); // used once
});

async function askForEmail(page) {
  await page.locator("#acct").getByRole("button", {name: "Sign in"}).click();
  await page.fill("#acct-email", "parent@example.com");
  await page.getByRole("button", {name: "Email me a code"}).click();
  await expect(page.locator("#acctsheet h2")).toHaveText("Check your email");
}

test("the code box comes back after the page reloads, while the code still works (phones reload while you read your email)", async ({browser}) => {
  const server = fakeServer();
  const page = await device(browser, server);
  await page.goto("/");
  await askForEmail(page);
  await page.reload();
  await page.locator("#acct").getByRole("button", {name: "Sign in"}).click();
  await expect(page.locator("#acctsheet h2")).toHaveText("Check your email");
  await page.fill("#acct-code", "246810");
  await page.locator("#acctsheet").getByRole("button", {name: "Sign in", exact: true}).click();
  await synced(page);
  expect(await page.evaluate(() => localStorage.getItem("d20plan-pending"))).toBeNull(); // forgotten once signed in

  const later = await device(browser, fakeServer());
  await later.goto("/");
  await askForEmail(later);
  await later.clock.setFixedTime(new Date("2026-11-09T10:31:00")); // 31 minutes later: the code has expired
  await later.reload();
  await later.locator("#acct").getByRole("button", {name: "Sign in"}).click();
  await expect(later.locator("#acctsheet h2")).toHaveText("Keep your plan on all your devices");
});

test("signing out asks first, and can keep the plan on this device (J7)", async ({browser}) => {
  const server = fakeServer();
  const page = await device(browser, server, {plan: LOCAL_PLAN});
  await page.goto(signedInAs("a"));
  await synced(page);
  await page.locator("#acct button").click();
  await page.getByRole("button", {name: "Sign out on this device"}).click();
  await expect(page.locator("#acctsheet")).toContainText("Keep a copy of your plan on this device?");
  await page.getByRole("button", {name: "Keep a copy and sign out"}).click();
  await expect(page.locator("#toast")).toHaveText("Signed out. Your plan is still on this device.");
  await expect(page.locator("#acct")).toHaveText("Sign in");
  await page.locator('.tab[data-tab="list"]').click();
  expect(await listNames(page)).toHaveLength(2);
  // Chosen, so not reported as an unexpected sign-out, and the email isn't kept.
  await page.locator('.tab[data-tab="home"]').click();
  await expect(page.getByText("Signed out on this device:")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("d20plan-email"))).toBeNull();
});

// What Supabase does when it ends a session itself: the stored session goes, then SIGNED_OUT.
const endSession = page => page.evaluate(() => { localStorage.removeItem("fake-session"); window.__fakeAuthEvent("SIGNED_OUT", null); });

test("if the sign-in ends on its own, say so: the plan is still here, and signing in again keeps it in sync (J7)", async ({browser}) => {
  const server = fakeServer();
  const page = await device(browser, server, {plan: LOCAL_PLAN});
  await page.goto(signedInAs("a"));
  await synced(page);
  await endSession(page);
  await expect(page.locator("#toast")).toHaveText("You were signed out on this device. Your plan is still here. Sign in again to keep it in sync.");
  await expect(page.locator("#acct")).toHaveText("Sign in");
  await page.locator('.tab[data-tab="home"]').click();
  await expect(page.getByText("Signed out on this device:")).toBeVisible();
  await expect(page.getByText("Keep your plan safe:")).toHaveCount(0); // it isn't only on this device
  await page.locator('.tab[data-tab="list"]').click();
  expect(await listNames(page)).toHaveLength(2);

  // A school saved while signed out is kept when signing in again.
  await page.locator('.tab[data-tab="find"]').click();
  await page.locator("#app").getByRole("button", {name: "☆ Save"}).first().click();
  await page.locator("#acct button").click();
  await expect(page.locator("#acctsheet h2")).toHaveText("Sign in again");
  await expect(page.locator("#acct-email")).toHaveValue("a@example.com");
  await page.goto("about:blank");
  await page.goto(signedInAs("a"));
  await synced(page);
  await expect.poll(() => server.plans["plan-a"].saved_schools.length).toBe(3);
  await page.locator('.tab[data-tab="home"]').click();
  await expect(page.getByText("Signed out on this device:")).toHaveCount(0);
});

test("a sign-in that ended while the planner was closed is explained on the next visit; Not you? forgets the email", async ({browser}) => {
  const server = fakeServer();
  const page = await device(browser, server, {plan: LOCAL_PLAN});
  await page.goto(signedInAs("a"));
  await synced(page);
  await page.evaluate(() => localStorage.removeItem("fake-session"));
  await page.reload();
  await expect(page.locator("#acct")).toHaveText("Sign in");
  await page.locator('.tab[data-tab="home"]').click();
  await expect(page.getByText("Signed out on this device:")).toBeVisible();
  await page.locator("#acct button").click();
  await expect(page.locator("#acct-email")).toHaveValue("a@example.com");
  await page.getByRole("button", {name: "Forget this email"}).click();
  await expect(page.locator("#acctsheet h2")).toHaveText("Keep your plan on all your devices");
  await expect(page.locator("#acct-email")).toHaveValue("");
  expect(await page.evaluate(() => localStorage.getItem("d20plan-email"))).toBeNull();
  await page.getByRole("button", {name: "← Back"}).click();
  await expect(page.getByText("Signed out on this device:")).toHaveCount(0);
});

test("signing out on a shared computer can remove the plan from it (J7)", async ({browser}) => {
  const server = fakeServer();
  const page = await device(browser, server, {plan: LOCAL_PLAN});
  await page.goto(signedInAs("a"));
  await synced(page);
  await page.locator("#acct button").click();
  await page.getByRole("button", {name: "Sign out on this device"}).click();
  await page.getByRole("button", {name: "Remove it and sign out"}).click();
  await expect(page.locator("#toast")).toHaveText("Signed out. Your plan was removed from this device.");
  await page.locator('.tab[data-tab="list"]').click();
  await expect(page.getByText("No schools saved yet.")).toBeVisible();
  expect(server.plans[server.byUser.a].saved_schools).toHaveLength(2); // still in the account
});

test("download my data gives a JSON file of everything in the account (J7)", async ({browser}) => {
  const server = fakeServer();
  const page = await device(browser, server, {plan: LOCAL_PLAN});
  await page.goto(signedInAs("a", "parent@example.com"));
  await synced(page);
  await page.locator("#acct button").click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", {name: "Download my data"}).click()]);
  expect(download.suggestedFilename()).toMatch(/^middle-school-plan-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
  expect(data.account).toEqual({email: "parent@example.com"});
  expect(data.saved_schools.map(r => r.dbn).sort()).toEqual(["20K187", "20K201"]);
  expect(data.plan.home).toBe("dyker");
  expect(JSON.stringify(data)).not.toContain("plan-a"); // no internal IDs
});

test("deleting an account needs DELETE typed, then removes the account and, if chosen, this device's copy (J7)", async ({browser}) => {
  const server = fakeServer();
  const page = await device(browser, server, {plan: LOCAL_PLAN});
  await page.goto(signedInAs("a"));
  await synced(page);
  await page.locator("#acct button").click();
  await page.getByRole("button", {name: "Delete my account…"}).click();
  const del = page.getByRole("button", {name: "Delete my account", exact: true});
  await expect(del).toBeDisabled();
  await page.fill("#acct-delete", "delete");
  await expect(del).toBeEnabled();
  await del.click();
  await expect(page.locator("#toast")).toHaveText("Your account is deleted, and your plan was removed from this device.");
  await expect(page.locator("#acct")).toHaveText("Sign in");
  expect(server.deleted).toEqual(["a"]);
  expect(server.byUser.a).toBeUndefined();
  await expect(page.getByText("New here?")).toBeVisible();
});

test("signed in, usage events and errors are sent, with IDs only (logging)", async ({browser}) => {
  const server = fakeServer();
  // The error is injected as an inline handler, which the Content-Security-Policy would block (security.spec.js).
  const page = await device(browser, server, {bypassCSP: true});
  page.removeAllListeners("pageerror"); // this test causes an error on purpose
  await page.goto(signedInAs("a"));
  await synced(page);
  await page.locator('.tab[data-tab="find"]').click();
  await page.locator("#app [data-save]").first().click();
  await page.locator("#app").evaluate(app => app.setAttribute("onclick", "throw new Error('test error')"));
  await page.locator("#app h2").first().click(); // an error in the page that nothing catches
  await expect.poll(() => server.events.map(e => e.name).sort()).toEqual(["app_open", "school_saved", "sign_in"]);
  await expect.poll(() => server.errors.map(e => e.message)).toEqual(["test error"]);
  expect(server.events.every(e => e.user_id === "a")).toBe(true);
  expect(server.events.find(e => e.name === "school_saved").props).toEqual({dbn: expect.stringMatching(/^\d{2}[KMXQR]\d{3}$/)});
  expect(server.errors[0].context).toMatch(/^page · \/ · find$/);
});

test("signed in, anything the Content-Security-Policy blocks is reported, without the address's query (logging)", async ({browser}) => {
  const server = fakeServer();
  const page = await device(browser, server);
  await page.goto(signedInAs("a"));
  await synced(page);
  await page.evaluate(() => document.body.insertAdjacentHTML("beforeend", '<img src="https://injected.example/pixel.png?email=parent@example.com">'));
  await expect.poll(() => server.errors.map(e => e.message)).toEqual(["CSP blocked img-src: https://injected.example/pixel.png"]);
  expect(server.errors[0].context).toMatch(/^csp · /);
});

test("signed-out visitors don't download the account library or contact any other site", async ({page}) => {
  const requests = [];
  page.on("request", r => requests.push(r.url()));
  await useFixtureData(page);
  await page.goto("/");
  await expect(page.locator("#acct")).toHaveText("Sign in");
  await page.locator('.tab[data-tab="find"]').click();
  expect(requests.filter(u => u.includes("/vendor/") || u.includes("supabase.co"))).toEqual([]);
  expect(requests.filter(u => new URL(u).origin !== "http://localhost:5174")).toEqual([]); // no fonts from Google either
});

// With the real backend (no fake): the sign-in in the address isn't even looked at by the account library.
test("a link that carries a sign-in doesn't download the account library or contact Supabase (F-65)", async ({page}) => {
  const requests = [];
  page.on("request", r => requests.push(r.url()));
  await useFixtureData(page);
  await page.goto("/#access_token=someone-elses&refresh_token=r&expires_in=3600&expires_at=1999999999&token_type=bearer&type=magiclink");
  await expect(page.locator("#acctsheet [role=alert]")).toContainText("The planner now signs in with a code");
  await expect(page.locator("#acct")).toHaveText("Sign in");
  expect(new URL(page.url()).hash).toBe("");
  expect(requests.filter(u => u.includes("/vendor/") || u.includes("supabase.co"))).toEqual([]);
});

// A shared computer, or a parent whose sign-in lapsed: the plan still on the device belongs to someone else (F-19).
async function signInAsSomeoneElse(browser, server) {
  const page = await device(browser, server, {plan: LOCAL_PLAN});
  await page.goto(signedInAs("a"));
  await synced(page);
  await page.evaluate(() => localStorage.removeItem("fake-session")); // a's sign-in ends on its own; the plan stays
  await page.reload();
  await page.locator("#acct").getByRole("button", {name: "Sign in"}).click();
  await page.fill("#acct-email", "b@example.com");
  await page.getByRole("button", {name: "Email me a code"}).click();
  await page.fill("#acct-code", server.code);
  await page.locator("#acctsheet").getByRole("button", {name: "Sign in", exact: true}).click();
  await expect(page.locator("#acctsheet h2")).toHaveText("Whose plan is on this device?");
  await expect(page.locator("#acctsheet")).toContainText("This device has a plan from a@example.com, and you're signing in as b@example.com.");
  await page.keyboard.press("Escape"); // it needs an answer
  await expect(page.locator("#acctsheet h2")).toHaveText("Whose plan is on this device?");
  expect(server.plans["plan-b"].saved_schools).toEqual([]); // nothing is added while the question is up
  return page;
}

test("someone else signing in on a device with a plan is asked first; No keeps that plan out of their account (F-19)", async ({browser}) => {
  const server = fakeServer();
  const page = await signInAsSomeoneElse(browser, server);
  await page.getByRole("button", {name: "No, use my account's plan"}).click();
  await synced(page);
  await expect(page.locator("#toast")).toHaveText("Signed in. Your plan is loaded.");
  await page.locator('.tab[data-tab="list"]').click();
  await expect(page.getByText("No schools saved yet.")).toBeVisible();
  expect(server.plans["plan-b"].saved_schools).toEqual([]);
  expect(server.plans["plan-a"].saved_schools).toHaveLength(2); // a's plan is still in a's account
  // The device's plan is now b's: b signing in here again isn't asked.
  expect(await page.evaluate(() => localStorage.getItem("d20plan-from"))).toBe("b@example.com");
});

test("someone else signing in on a device with a plan can choose to add it to their account (F-19)", async ({browser}) => {
  const server = fakeServer();
  const page = await signInAsSomeoneElse(browser, server);
  await page.getByRole("button", {name: "Yes, add it to my account"}).click();
  await synced(page);
  await expect.poll(() => server.plans["plan-b"].saved_schools.map(r => r.dbn)).toEqual(["20K201", "20K187"]);
});

test("a failed save is tried again by itself, without waiting for another change (F-13)", async ({browser}) => {
  const server = fakeServer();
  const page = await device(browser, server, {plan: LOCAL_PLAN});
  await page.goto(signedInAs("a"));
  await synced(page);
  server.failSaves = true;
  await page.locator('.tab[data-tab="find"]').click();
  const answers = page.locator(".prefs-sum");
  if (await answers.isVisible()) await answers.getByRole("button", {name: "Edit answers"}).click(); // phones fold the answers
  await page.selectOption("#home", "boro");
  await expect(page.locator("#toast")).toContainText("Couldn't save to your account. We'll keep trying.");
  server.failSaves = false; // the server recovers; the family does nothing more
  await expect.poll(() => server.plans["plan-a"].plan.home, {timeout: 15000}).toBe("boro");
});

test("two tabs of the planner share one plan: a change in one shows in the other, and neither undoes the other's (F-18)", async ({browser}) => {
  const context = await browser.newContext();
  contexts.push(context);
  const open = async () => { const p = await context.newPage(); await useFixtureData(p); await p.goto("/#find"); return p; };
  const one = await open(), two = await open();
  await one.locator("#app").getByRole("button", {name: "☆ Save"}).first().click();
  await expect(two.locator("#app").getByRole("button", {name: "★ Saved"})).toHaveCount(1); // the other tab shows it
  await two.locator("#app").getByRole("button", {name: "☆ Save"}).first().click();
  await expect(one.locator("#app").getByRole("button", {name: "★ Saved"})).toHaveCount(2);
  expect(await one.evaluate(() => JSON.parse(localStorage.getItem("d20plan")).saved.length)).toBe(2); // both kept
});
