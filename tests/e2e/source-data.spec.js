// Journey J5 (source data changes) and the J1 failure case (data doesn't load). See docs/journeys.md.
import {test, expect} from "@playwright/test";
import {useFixtureData} from "./fixture-data.js";
import fixtureEvents from "../unit/fixtures/data-2026-10-16/events.json" with {type: "json"};

test.beforeEach(async ({page}) => {
  await useFixtureData(page);
  await page.clock.setFixedTime(new Date("2026-11-09T10:00:00"));
});

test("if the school data can't load, say so and offer to try again", async ({page}) => {
  await page.route("**/data/schools.json", r => r.abort());
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("The planner couldn't load.");
  await page.unroute("**/data/schools.json");
  await page.getByRole("button", {name: "Try again"}).click();
  await expect(page.locator(".hero")).toBeVisible();
});

test("every tab says how fresh the data is, and each school says where its numbers come from", async ({page}) => {
  page.on("pageerror", e => { throw e; });
  await page.goto("/");
  await expect(page.locator(".data-foot")).toContainText("Data last updated Oct 16, 2026.");
  await expect(page.locator(".data-foot a").first()).toHaveAttribute("href", /^https:\/\//);
  await page.goto("/#dates");
  await expect(page.getByText("Last updated Oct 16, 2026.")).toBeVisible();
  await page.locator("#app [data-open]").first().click();
  await expect(page.locator("#sheet")).toContainText("Source: InsideSchools school profiles, updated Oct 16, 2026.");
});

test("an open house that moved shows Changed and its old time", async ({page}) => {
  page.on("pageerror", e => { throw e; });
  await page.route("**/data/events.json", async r => {
    const json = structuredClone(fixtureEvents);
    const ev = json.events.find(e => e.id === "oh-20K187-2026-11-10-1730");
    Object.assign(ev, {start: "18:00", was: {date: "2026-11-10", start: "17:30"}});
    await r.fulfill({json});
  });
  await page.goto("/#dates");
  await page.click('[data-dv="list"]');
  const row = page.locator(".ev", {hasText: "I.S. 187"});
  await expect(row.locator(".pill", {hasText: "Changed"})).toBeVisible();
  await expect(row).toContainText("Moved. It was Tuesday, Nov 10 · 5:30 PM – 7:30 PM.");
  await expect(row).toContainText("Tuesday, Nov 10 · 6 PM – 7:30 PM");
});
