// What families type is shown as text, and the Content-Security-Policy stops scripts that get in anyway (docs/security.md).
import {test, expect} from "@playwright/test";
import {useFixtureData} from "./fixture-data.js";

const ATTACK = `<img src=x onerror="window.__ran=1">`;

test.beforeEach(async ({page}) => {
  await useFixtureData(page);
  await page.clock.setFixedTime(new Date("2026-11-09T10:00:00"));
});

test("a note that looks like code is shown as text and never runs", async ({page}) => {
  page.on("pageerror", e => { throw e; });
  await page.goto("/");
  await page.locator('.tab[data-tab="find"]').click();
  await page.locator("#app [data-open]").first().click();
  await page.fill("#pros-input", ATTACK);
  await page.locator("[data-addnote$=':pros']").click();
  await expect(page.locator(".notelist.pros li span")).toHaveText(ATTACK);
  await expect(page.locator(".notelist.pros img")).toHaveCount(0);
  expect(await page.evaluate(() => window.__ran)).toBeUndefined();
});

test("the Content-Security-Policy blocks inline scripts", async ({page}) => {
  await page.goto("/");
  await expect(page.locator("#acct")).toHaveText("Sign in");
  const blocked = page.evaluate(() => new Promise(resolve =>
    document.addEventListener("securitypolicyviolation", e => resolve(e.violatedDirective), {once: true})));
  // Code that somehow got into the page, as an inline handler and as an inline script.
  await page.evaluate(html => {
    const s = document.createElement("script"); s.textContent = "window.__ran=1"; document.body.append(s);
    document.body.insertAdjacentHTML("beforeend", html);
  }, ATTACK);
  expect(await blocked).toMatch(/^script-src/);
  expect(await page.evaluate(() => window.__ran)).toBeUndefined();
});
