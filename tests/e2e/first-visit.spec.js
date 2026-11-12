// Journey J1 (docs/journeys.md): a first visit, signed out, on one device.
import {test, expect} from "@playwright/test";
import {useFixtureData} from "./fixture-data.js";

test.beforeEach(async ({page}) => {
  await useFixtureData(page);
  await page.clock.setFixedTime(new Date("2026-11-09T10:00:00"));
  page.on("pageerror", e => { throw e; });
});

test("a blank start points families who already made a plan to sign in and get it back", async ({page}) => {
  await page.goto("/");
  await expect(page.getByText("Already made a plan?")).toBeVisible();
  await page.locator(".notice").getByRole("button", {name: "Sign in"}).click();
  await expect(page.locator("#acctsheet h2")).toHaveText("Keep your plan on all your devices");
});

test("first visit: pick a neighborhood, save a school, plan a visit, and keep it after reload", async ({page}) => {
  await page.goto("/");
  await expect(page.locator(".hero .big")).toHaveText("32");
  await expect(page.getByText("Start here:")).toBeVisible();

  await page.locator('.tab[data-tab="find"]').click();
  await page.selectOption("#home", "dyker");
  await expect(page.locator("#app .sc").first()).toContainText("mi");

  const first = page.locator("#app .sc").first();
  const name = await first.locator("h3").textContent();
  await first.getByRole("button", {name: "☆ Save"}).click();
  await expect(page.locator("#toast")).toHaveText("Saved to My list");
  await page.locator('.tab[data-tab="home"]').click();
  await expect(page.getByText("Start here:")).toHaveCount(0); // only on the very first visit
  await expect(page.getByText("Keep your plan safe:")).toBeVisible();

  await page.locator('.tab[data-tab="dates"]').click();
  await page.click('[data-dv="list"]');
  await page.click('[data-df="mine"]');
  await page.locator("#app [data-going]").first().click();
  await expect(page.locator("#app [data-going]").first()).toHaveText("✓ I'm going");

  await page.reload();
  await page.locator('.tab[data-tab="list"]').click();
  await expect(page.locator("#app .sc h3").first()).toHaveText(name);
  await page.locator('.tab[data-tab="home"]').click();
  await expect(page.locator(".pill.good").first()).toHaveText("2 of 8 done");
});

test("school sheet: rate and add a note", async ({page}) => {
  await page.goto("/#find");
  await page.locator("#app [data-open]").first().click();
  await page.click('#sheet [data-star$=":4"]');
  await page.fill("#pros-input", "Friendly teachers");
  await page.press("#pros-input", "Enter");
  await page.click("#sheet button[data-close]");
  await expect(page.locator("#app .ournote").first()).toContainText("Really like it · 1 like");
});

test("reminders are grouped in one box, and there's no missed-open-house notice", async ({page}) => {
  const plan = {home: "dyker", saved: ["20K187", "20K201", "20K223"],
    going: ["oh-20K187-2026-11-10-1730", "oh-20K201-2026-11-09-1700", "oh-20K223-2026-11-04-1730"], attended: []};
  await page.addInitScript(p => { if (!localStorage.getItem("d20plan")) localStorage.setItem("d20plan", p); }, JSON.stringify(plan));
  await page.goto("/");
  const box = page.locator(".notice", {has: page.locator(".notice-list")});
  await expect(box).toHaveCount(1);
  await expect(box.locator(".notice-list > div")).toHaveCount(3);
  await expect(box).toContainText("tomorrow");
  await expect(box).toContainText("today");
  await expect(box).toContainText("Did you go?");
  await expect(page.locator("#app .notice")).toHaveCount(3); // reminders + Keep your plan safe + what the planner is (no pilot notice: PILOT is off)
  await expect(page.getByText("Start here:")).toHaveCount(0);
  await expect(page.getByText("Missed an open house")).toHaveCount(0);
});

test("with nothing urgent, Home has no reminders box: the steps say what's next", async ({page}) => {
  await page.addInitScript(p => { if (!localStorage.getItem("d20plan")) localStorage.setItem("d20plan", p); }, JSON.stringify({home: "dyker", done: {s1: true}}));
  await page.goto("/");
  await expect(page.locator(".notice-list")).toHaveCount(0);
  await expect(page.locator(".st-item.current")).toContainText("You are here");
});

test("after the deadline the list is read-only and Next up says when offers arrive (J6)", async ({page}) => {
  await page.clock.setFixedTime(new Date("2026-12-14T10:00:00"));
  await page.addInitScript(p => { if (!localStorage.getItem("d20plan")) localStorage.setItem("d20plan", p); }, JSON.stringify({home: "dyker", saved: ["20K187", "20K201"]}));
  await page.goto("/");
  await expect(page.locator(".notice-list")).toContainText("Applications are closed. Offers arrive April 7, 2027.");
  await page.locator('.tab[data-tab="list"]').click();
  await expect(page.getByText("This is your list as it was then.")).toBeVisible();
  await expect(page.locator("#app")).toContainText("Didn't submit?"); // the planner can't know whether they did
  await expect(page.locator("[data-mv]")).toHaveCount(0);
});
