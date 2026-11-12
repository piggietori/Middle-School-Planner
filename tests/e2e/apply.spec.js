// Applying happens in MySchools, not here: the planner says so on every step that leads there (journey J6).
import {test, expect} from "@playwright/test";
import {useFixtureData} from "./fixture-data.js";

const PLAN = {home: "dyker", saved: ["20K201", "20K187", "20K229"], done: {s1: true, s2: true, s5: true, s6o: true}};
test.beforeEach(async ({page}) => {
  await useFixtureData(page);
  await page.clock.setFixedTime(new Date("2026-11-09T10:00:00"));
  page.on("pageerror", e => { throw e; });
});
const withPlan = (page, plan = PLAN) =>
  page.addInitScript(p => { if (!localStorage.getItem("d20plan")) localStorage.setItem("d20plan", p); }, JSON.stringify(plan));

test("Home says where to apply, marks the MySchools steps as required, and sends families to Finalize & apply", async ({page}) => {
  await withPlan(page);
  await page.goto("/");
  await expect(page.locator(".hero h2")).toHaveText("days left to apply in MySchools");
  await expect(page.locator(".hero")).toContainText("It doesn't send your application.");
  await expect(page.locator(".st-item.ms")).toHaveCount(2);
  await expect(page.locator(".st-item.ms .pill.req")).toHaveText(["Required · in MySchools", "Required · in MySchools"]);
  await expect(page.getByText("Your list is ready.")).toHaveCount(0); // step 6 already says it
  await page.locator(".st-item.ms").first().locator(".st-head").click();
  await page.locator(".st-item.ms").first().getByRole("button", {name: "Finalize & apply"}).click();
  await expect(page.locator(".tab[aria-current=page]")).toHaveAttribute("data-tab", "list");
  await expect(page.locator("#app h2").first()).toHaveText("Finalize and apply");
});

test("Apply in MySchools lists the codes in order, and ticking it off marks steps 6 and 7 and stops the reminders", async ({page}) => {
  await withPlan(page);
  await page.goto("/#list");
  await expect(page.locator(".notice", {hasText: "Your list doesn't count until you submit it in MySchools."})).toBeVisible();
  await page.locator('.seg [data-lv="apply"]').click();
  await expect(page.locator("#myschools")).toContainText("make sure you submit your application in MySchools.");
  await expect(page.locator(".ms-codes code")).toHaveText(["20K201", "20K187", "20K229"]);
  await page.locator(".ms-codes li").nth(1).getByRole("button", {name: /up$/}).click(); // finalize the order here
  await expect(page.locator(".ms-codes code")).toHaveText(["20K187", "20K201", "20K229"]);
  await expect(page.locator("#myschools")).toContainText("Auditions and screens:");
  await page.getByRole("button", {name: "I submitted in MySchools"}).click();
  await expect(page.getByRole("button", {name: "✓ I submitted in MySchools"})).toHaveAttribute("aria-pressed", "true");

  await page.reload(); // the view and the answer are both kept
  await expect(page.getByRole("button", {name: "✓ I submitted in MySchools"})).toBeVisible();
  await page.locator('.seg [data-lv="order"]').click();
  await expect(page.locator("#app")).toContainText("You marked your application as submitted.");
  await page.locator('.tab[data-tab="home"]').click();
  await expect(page.locator(".pill.good").first()).toHaveText("6 of 8 done");
  await expect(page.locator(".st-item.ms .pill.req")).toHaveCount(0);
  await expect(page.locator(".st-item.ms .pill.good").last()).toHaveText("Submitted");
});

test("with no schools saved, Apply in MySchools sends families to Find schools first", async ({page}) => {
  await page.goto("/#list");
  await page.locator('.seg [data-lv="apply"]').click();
  await expect(page.locator("#app")).toContainText("tap ☆ Save on each school you like");
  await expect(page.locator("#myschools")).toHaveCount(0);
});

test("what the planner is shows once on Home until dismissed", async ({page}) => {
  await page.goto("/");
  const about = page.locator(".notice", {hasText: "Built by a D20 parent to explore schools"});
  await expect(about).toContainText("make sure you submit your application in MySchools.");
  await about.getByRole("button", {name: "Got it"}).click();
  await expect(about).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Built by a D20 parent to explore schools")).toHaveCount(0);
});

test("the school sheet says what to search for in MySchools", async ({page}) => {
  await page.goto("/#find");
  await page.locator("#app [data-open]").first().click();
  await expect(page.locator("#sheet")).toContainText("In MySchools: search for");
});

test("open houses show every action, with nothing hidden behind More", async ({page}) => {
  await page.goto("/#dates");
  await page.click('[data-dv="list"]');
  const ev = page.locator("#app .ev", {has: page.locator("[data-going]")}).first();
  await expect(ev.getByRole("link", {name: "Add to my calendar"})).toBeVisible();
  await expect(page.locator("details.more")).toHaveCount(0);
});

test("Compare notes is in my order, and moving a school there moves it in My order", async ({page}) => {
  await withPlan(page, {...PLAN, notes: {"20K229": {rating: 5, pros: [], cons: [], updated: 1}}});
  await page.goto("/#list");
  await page.locator('.seg [data-lv="compare"]').click();
  await expect(page.locator(".cmp thead .rank").first()).toContainText("#1 on my list");
  await page.locator(".cmp thead th").nth(0).getByRole("button", {name: /later$/}).click();
  await page.locator('.seg [data-lv="order"]').click();
  await expect(page.locator("#app .sc .rank").first()).toContainText("20K187");
});

test("on a phone, Find folds answers already given so the matches come first", async ({page, isMobile}) => {
  test.skip(!isMobile, "wide screens show the answers and the matches side by side");
  await withPlan(page);
  await page.goto("/#find");
  await expect(page.locator(".prefs")).toBeHidden();
  await expect(page.locator(".prefs-sum")).toContainText("Dyker Heights");
  await page.getByRole("button", {name: "Edit answers"}).click();
  await expect(page.locator(".prefs")).toBeVisible();
  await page.locator('[data-w="scores:2"]').click(); // still open while they change things
  await expect(page.locator(".prefs")).toBeVisible();
  await page.getByRole("button", {name: "See my matches"}).click();
  await expect(page.locator(".prefs")).toBeHidden();
});

test("My list flags top matches from Find that aren't on the list, and saving one clears it", async ({page}) => {
  await withPlan(page, {home: "dyker", saved: [], done: {s1: true}});
  await page.goto("/#find");
  const cards = page.locator("#app article.sc");
  await expect(cards.nth(3)).toBeVisible();
  const top = await cards.locator("h3").evaluateAll(hs => hs.slice(0, 4).map(h => h.textContent));
  await cards.nth(3).getByRole("button", {name: "☆ Save"}).click();
  await page.locator('.tab[data-tab="list"]').click();
  const flag = page.locator("#missing-top");
  await expect(flag).toContainText("Not on your list");
  await expect(flag).toContainText(top[0]);
  await expect(flag).not.toContainText(top[3]);
  await flag.getByRole("button", {name: "☆ Save"}).first().click();
  await expect(page.locator("#app")).toContainText(top[0]);
  await expect(flag.getByText(top[0])).toHaveCount(0);
  await page.locator("#app [data-lv=apply]").first().click();
  await expect(page.locator("#myschools #missing-top")).toHaveCount((await page.locator("#app").textContent()).includes("Not on your list") ? 1 : 0);
});

test("no top-match flag before the family says where they live", async ({page}) => {
  await withPlan(page, {saved: ["20K187"], done: {}});
  await page.goto("/#list");
  await expect(page.locator("#app h2").first()).toHaveText("My list");
  await expect(page.locator("#missing-top")).toHaveCount(0);
});
