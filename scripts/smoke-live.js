// The live site, as a signed-out visitor sees it, in real browsers: Chromium on a desktop and WebKit (Safari's engine)
// on an iPhone. Signed-out visitors send us no errors (docs/privacy.md), so this is how we'd hear about a crash
// only they hit. The monitor in planner-ops runs it every 3 hours (docs/failure-modes.md); run it by hand with
//   node scripts/smoke-live.js https://piggietori.github.io/Middle-School-Planner/
// It prints one line per browser, and exits 1 if anything is wrong.
import {chromium, devices, webkit} from "@playwright/test";

const url = process.argv[2] || process.env.SITE_URL;
if (!url) { console.error("Usage: node scripts/smoke-live.js <site url>"); process.exit(2); }

async function visit(name, browserType, device) {
  const browser = await browserType.launch();
  const problems = [];
  try {
    const page = await (await browser.newContext({...device})).newPage();
    page.on("pageerror", e => problems.push(`error: ${e.message}`));
    page.on("console", m => { if (m.type() === "error" && !/favicon/i.test(m.text())) problems.push(`console: ${m.text().slice(0, 200)}`); });
    const res = await page.goto(url, {waitUntil: "networkidle", timeout: 30000});
    if (!res?.ok()) throw new Error(`${res?.status()} from ${url}`);
    if (await page.getByText("The planner couldn't load").count()) throw new Error("it shows \"The planner couldn't load\"");
    await page.locator("#app .view").first().waitFor({timeout: 15000});
    await page.locator('.tab[data-tab="dates"]').click();
    await page.locator("#app .day").first().waitFor({timeout: 10000});
    await page.locator('.tab[data-tab="find"]').click();
    await page.locator("#app [data-open]").first().click();
    await page.locator('#sheet [role="dialog"]').waitFor({timeout: 10000});
  } catch (e) {
    problems.push(e.message.split("\n")[0]);
  } finally {
    await browser.close();
  }
  console.log(`${problems.length ? "FAIL" : "ok  "} ${name}${problems.length ? ": " + problems.join("; ") : ""}`);
  return problems.length === 0;
}

const results = [await visit("Chromium, desktop", chromium, devices["Desktop Chrome"]), await visit("Safari (WebKit), iPhone", webkit, devices["iPhone 14"])];
process.exit(results.every(Boolean) ? 0 : 1);
