// Journey J1 (docs/journeys.md): a first visit, signed out, on one device.
import {test, expect} from "@playwright/test";
import {useFixtureData} from "./fixture-data.js";

test.beforeEach(async ({page}) => {
  await useFixtureData(page);
  await page.clock.setFixedTime(new Date("2026-11-09T10:00:00"));
  page.on("pageerror", e => { throw e; });
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
