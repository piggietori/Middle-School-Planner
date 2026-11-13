// Reading an InsideSchools profile: the numbers come out right, a missing answer is "no data",
// and a page we can't read is an error, never "no data".
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {parseProfile, profileUrl} from "../../scripts/lib/insideschools.js";

const html = fs.readFileSync(path.resolve(import.meta.dirname, "fixtures/insideschools-profile.html"), "utf8");

test("survey answers, citywide averages, enrollment and the survey year are read from a profile", () => {
  assert.deepEqual(parseProfile(html), {period: "2024-25", city: {safe: 80, bully: 59, teach: 85}, safe: 89, bully: 62, teach: 100, size: 1274});
  assert.equal(profileUrl("20K407"), "https://insideschools.org/school/20K407");
});

test("an answer the page doesn't show is null; the others are still read", () => {
  const p = parseProfile(html.replace(/students think bullying happens most or all of the time/, "students like lunch"));
  assert.equal(p.bully, null);
  assert.equal(p.city.bully, null);
  assert.equal(p.safe, 89);
  assert.equal(parseProfile(html.replace("1,274", "N/A")).size, null);
});

test("a page without the survey section is an error, not \"no data\"", () => {
  assert.throws(() => parseProfile("<html><body>Just a moment...</body></html>"), /no NYC School Survey section/);
  assert.throws(() => parseProfile(html.replaceAll("stat-title", "metric-name")), /no NYC School Survey section/);
});
