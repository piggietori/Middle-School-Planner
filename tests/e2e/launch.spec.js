// Before other households use it (docs/launch.md): the pilot notice, privacy and help links, the announcement
// banner, invite-only sign-in, and accessibility.
import AxeBuilder from "@axe-core/playwright";
import {test, expect} from "@playwright/test";
import {useFixtureData} from "./fixture-data.js";
import {fakeServer, useFakeBackend} from "./fake-backend.js";

test.beforeEach(async ({page}) => {
  await useFixtureData(page);
  await page.clock.setFixedTime(new Date("2026-11-09T10:00:00"));
});

const banner = (page, notice) => page.route(/\/data\/notice\.json$/, r => r.fulfill({json: {schema_version: 1, notice}}));

test("the pilot is labeled, its notice can be dismissed, and My list says where the application really happens", async ({page}) => {
  await page.goto("/");
  await expect(page.locator("#pilot")).toBeVisible();
  const notice = page.locator(".notice", {hasText: "This planner is a pilot."});
  await expect(notice).toContainText("not by NYC Public Schools");
  await expect(notice.getByRole("button", {name: "Tell us about a problem"})).toBeVisible();
  await notice.getByRole("button", {name: "Got it"}).click();
  await expect(notice).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".notice", {hasText: "This planner is a pilot."})).toHaveCount(0); // once per device
  await page.locator('.tab[data-tab="list"]').click();
  await expect(page.locator("#app")).toContainText("Your application counts only when you submit it in MySchools.");
});

test("every page links to the privacy notice and to help, and the notice page works under the security policy", async ({page}) => {
  const violations = [];
  page.on("console", m => { if (/refused|violat/i.test(m.text())) violations.push(m.text()); });
  await page.goto("/");
  const foot = page.locator("footer.data-foot");
  await expect(foot.getByRole("button", {name: "Send feedback"})).toBeVisible();
  await foot.getByRole("link", {name: "Privacy & terms"}).click();
  await expect(page.locator("h1")).toHaveText("Privacy and terms");
  await expect(page.locator("[data-pilot]")).toBeVisible();
  await expect(page.locator("a[data-help]").first()).toHaveAttribute("href", /^mailto:help@/);
  expect(violations).toEqual([]);
});

test("the announcement banner shows on every tab, and not after its last day", async ({page}) => {
  await banner(page, {text: "The open house at I.S. 187 moved to Thursday.", level: "warn", until: "2026-11-12"});
  await page.goto("/");
  await expect(page.locator(".banner")).toHaveText(/moved to Thursday/);
  await page.locator('.tab[data-tab="dates"]').click();
  await expect(page.locator(".banner")).toBeVisible();
  await page.clock.setFixedTime(new Date("2026-11-13T10:00:00"));
  await page.reload();
  await expect(page.locator(".banner")).toHaveCount(0);
});

test("while sign-ups are off, an address nobody invited is told the planner is invite-only", async ({browser}) => {
  const server = fakeServer();
  server.invited = ["invited@example.com"];
  const context = await browser.newContext();
  await useFakeBackend(context, server);
  const page = await context.newPage();
  await useFixtureData(page);
  await page.goto("/");
  await page.locator("#acct button").click();
  await expect(page.locator("#acctsheet")).toContainText("By signing in you agree to the privacy notice and terms.");
  await page.fill("#acct-email", "stranger@example.com");
  await page.getByRole("button", {name: "Email me a sign-in link"}).click();
  await expect(page.locator("#acctsheet [role=alert]")).toContainText("The planner is invite-only for now.");
  await page.fill("#acct-email", "invited@example.com");
  await page.getByRole("button", {name: "Email me a sign-in link"}).click();
  await expect(page.locator("#acctsheet h2")).toHaveText("Check your email");
  expect(server.outbox).toEqual(["invited@example.com"]);
  await context.close();
});

test("Send feedback goes straight to the owner, without the account, and keeps the message if sending fails", async ({page}) => {
  const sent = [];
  let fail = true;
  await page.route(/\/rest\/v1\/feedback$/, r => {
    if (fail) return r.fulfill({status: 503, body: "down"});
    sent.push({body: r.request().postDataJSON(), auth: r.request().headers().authorization});
    return r.fulfill({status: 201, body: ""});
  });
  await page.goto("/#dates");
  await page.locator("footer.data-foot").getByRole("button", {name: "Send feedback"}).click();
  await page.getByLabel("A date or school detail is wrong").check();
  await page.fill("#fb-message", "The I.S. 187 open house moved to Thursday.");
  await page.getByRole("button", {name: "Send", exact: true}).click();
  await expect(page.locator("#fbsheet [role=alert]")).toContainText("Couldn't send it.");
  await expect(page.locator("#fb-message")).toHaveValue("The I.S. 187 open house moved to Thursday."); // nothing lost
  fail = false;
  await page.fill("#fb-reply", "parent@example.com");
  await page.getByRole("button", {name: "Send", exact: true}).click();
  await expect(page.locator("#toast")).toHaveText("Thanks! Your feedback was sent.");
  await expect(page.locator("#fbsheet .sheet")).toHaveCount(0);
  expect(sent).toEqual([{body: {kind: "wrong_info", message: "The I.S. 187 open house moved to Thursday.", reply_to: "parent@example.com", page: "dates"}, auth: undefined}]);
});

// Serious and critical problems only: the ones that stop someone using the planner with a screen reader,
// keyboard or low vision.
const serious = async page => (await new AxeBuilder({page}).analyze()).violations
  .filter(v => ["serious", "critical"].includes(v.impact))
  .map(v => `${v.id}: ${v.nodes.map(n => n.target.join(" ")).slice(0, 3).join(", ")}`);

test("no serious accessibility problems on any tab, the account sheet, or the privacy notice", async ({page}) => {
  await page.emulateMedia({reducedMotion: "reduce"}); // check sheets as they settle, not mid slide-in
  await page.addInitScript(() => { if (!localStorage.getItem("d20plan")) localStorage.setItem("d20plan", JSON.stringify({home: "dyker", saved: ["20K201", "20K187"], going: [], attended: [], done: {s1: true}, notes: {}})); });
  await page.goto("/");
  for (const tab of ["home", "dates", "find", "list"]) {
    await page.locator(`.tab[data-tab="${tab}"]`).click();
    expect(await serious(page), tab).toEqual([]);
  }
  await page.locator("#app [data-open]").first().click();
  expect(await serious(page), "school sheet").toEqual([]);
  await page.locator("#sheet button[data-close]").click();
  await page.locator("#acct button").click();
  expect(await serious(page), "account sheet").toEqual([]);
  await page.locator("#acctsheet").getByRole("button", {name: "← Back"}).click();
  await page.locator("footer.data-foot").getByRole("button", {name: "Send feedback"}).click();
  expect(await serious(page), "feedback").toEqual([]);
  await page.goto("/privacy.html");
  expect(await serious(page), "privacy").toEqual([]);
});
