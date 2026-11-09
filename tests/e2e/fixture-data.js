// Serve the frozen copy of data/*.json so walk-throughs don't depend on today's data.
import path from "node:path";

const dir = path.resolve(import.meta.dirname, "../unit/fixtures/data-2026-10-16");

export async function useFixtureData(page) {
  await page.route(/\/data\/(schools|events|neighborhoods|steps)\.json$/, r =>
    r.fulfill({path: path.join(dir, path.basename(new URL(r.request().url()).pathname))}));
}
