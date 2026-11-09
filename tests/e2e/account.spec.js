// Journeys J2 (sign in and keep what I did) and J3 (come back on another device). See docs/journeys.md.
// Uses an in-memory fake of the account server (fake-backend.js), shared by both "devices".
import {test, expect} from "@playwright/test";
import {useFixtureData} from "./fixture-data.js";
import {fakeServer, useFakeBackend} from "./fake-backend.js";

const link = (uid, email = uid + "@example.com") => `/#access_token=fake&uid=${uid}&email=${encodeURIComponent(email)}`;
const LOCAL_PLAN = JSON.stringify({home: "dyker", saved: ["20K201", "20K187"], going: ["oh-20K201-2026-11-09-1700"], attended: [], done: {s1: true, s2: true}, notes: {}});

async function device(browser, server, {plan} = {}) {
  const context = await browser.newContext();
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
  await page.getByRole("button", {name: "Email me a sign-in link"}).click();
  await expect(page.locator("#acctsheet")).toContainText("We sent a sign-in link to parent@example.com");
  expect(server.outbox).toEqual(["parent@example.com"]);

  await page.goto("about:blank"); // the link from the email opens as a new page load, not a hash change
  await page.goto(link("a", "parent@example.com"));
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
  await laptop.goto(link("a"));
  await synced(laptop);

  const phone = await device(browser, server);
  await phone.goto(link("a"));
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
  await laptop.goto(link("a"));
  await synced(laptop);
  await laptop.locator('.tab[data-tab="dates"]').click();
  await laptop.click('[data-dv="list"]');
  await laptop.locator('.tab[data-tab="find"]').click();
  await laptop.locator("#app [data-open]").first().click();
  const school = (await laptop.locator("#sheet [role=dialog]").getAttribute("aria-label"));
  await expect.poll(() => server.sessions.a?.last_dbn).toBeTruthy();
  expect(server.sessions.a).toMatchObject({last_tab: "find", last_view: null});

  const phone = await device(browser, server);
  await phone.goto(link("a"));
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
  await first.goto(link("a"));
  await synced(first);

  const other = await device(browser, server, {plan: JSON.stringify({home: "boro", saved: ["20K030"], going: [], attended: [], done: {s5: true}, notes: {}})});
  await other.goto(link("a"));
  await expect(other.locator("#toast")).toHaveText("Signed in. We added this device's plan to your account.");
  await other.locator('.tab[data-tab="list"]').click();
  expect(await listNames(other)).toEqual(["J.H.S. 201 The Madeleine Brennan School", "I.S. 187 The Christa McAuliffe School", "P.S./I.S. 30 Mary White Ovington"]);
  await expect.poll(() => server.plans[server.byUser.a].saved_schools.length).toBe(3);
  expect(server.plans[server.byUser.a].plan.home).toBe("dyker"); // the account's settings win
});

test("if saving fails, say so, keep the change on the device, and send it when back online", async ({browser}) => {
  const server = fakeServer();
  const page = await device(browser, server, {plan: LOCAL_PLAN});
  await page.goto(link("a"));
  await synced(page);
  server.failSaves = true;
  await page.locator('.tab[data-tab="find"]').click();
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
  await page.goto(link("a"));
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

test("an expired sign-in link explains what happened and offers a new one", async ({browser}) => {
  const page = await device(browser, fakeServer());
  await page.goto("/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  await expect(page.locator("#acctsheet [role=alert]")).toHaveText("That sign-in link has expired or was already used. Send yourself a new one.");
  await expect(page.locator("#acct-email")).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
});

test("signing out keeps the plan on this device", async ({browser}) => {
  const server = fakeServer();
  const page = await device(browser, server, {plan: LOCAL_PLAN});
  await page.goto(link("a"));
  await synced(page);
  await page.locator("#acct button").click();
  await page.getByRole("button", {name: "Sign out on this device"}).click();
  await expect(page.locator("#toast")).toHaveText("Signed out. Your plan is still on this device.");
  await expect(page.locator("#acct")).toHaveText("Sign in");
  await page.locator('.tab[data-tab="list"]').click();
  expect(await listNames(page)).toHaveLength(2);
});

test("signed-out visitors don't download the account library or contact the server", async ({page}) => {
  const requests = [];
  page.on("request", r => requests.push(r.url()));
  await useFixtureData(page);
  await page.goto("/");
  await expect(page.locator("#acct")).toHaveText("Sign in");
  await page.locator('.tab[data-tab="find"]').click();
  expect(requests.filter(u => u.includes("/vendor/") || u.includes("supabase.co"))).toEqual([]);
});
