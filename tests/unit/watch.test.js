import test from "node:test";
import assert from "node:assert/strict";
import {pageText, pageFiles, fingerprint, openDataId} from "../../scripts/lib/watch.js";

const page = (date, extra = "") => `<html><head><style>.x{}</style><script>var t=${Math.random()}</script></head>
  <body${extra}><h1>Open houses</h1><p>IS 187: ${date}&nbsp;at 5:30 PM</p>
  <a href="https://www.google.com/url?q=https%3A%2F%2Fdrive.google.com%2Ffile%2Fd%2FabcDEF123%2Fview&amp;sa=D&amp;usg=${Math.random()}">Flyer</a></body></html>`;

test("visible text only, with entities decoded and spaces collapsed", () => {
  assert.equal(pageText(page("Nov 10")), "Open houses IS 187: Nov 10 at 5:30 PM Flyer");
});

test("file links are unwrapped from Google redirects and lose their tracking codes", () => {
  assert.deepEqual(pageFiles(page("Nov 10")), ["google-file:abcDEF123"]);
  assert.deepEqual(pageFiles(`<a href="/x/calendar.pdf?v=2">a</a><a href="/about">b</a>`), ["/x/calendar.pdf?v=2"]);
});

test("markup, scripts and tracking codes don't count as a change; a new date or flyer does", () => {
  assert.equal(fingerprint(page("Nov 10")), fingerprint(page("Nov 10", ` class="theme-2"`)));
  assert.notEqual(fingerprint(page("Nov 10")), fingerprint(page("Nov 12")));
  assert.notEqual(fingerprint(page("Nov 10")), fingerprint(page("Nov 10").replace("abcDEF123", "newFlyer9")));
});

test("NYC Open Data datasets are recognized by their id", () => {
  assert.equal(openDataId("https://data.cityofnewyork.us/d/dnpx-dfnc"), "dnpx-dfnc");
  assert.equal(openDataId("https://www.schools.nyc.gov/MS"), undefined);
});
