// Save, per school, the text a music, arts or science & tech tag can rest on: the InsideSchools program
// list and review, the school's home page, and every page a tag's evidence points at (tag_evidence).
// Written to .cache/tag-sources/<DBN>.txt, which is not in the repository. Then check that every stored
// quote is still found, word for word, in what was just fetched.
// Usage: node scripts/fetch-tag-sources.js     (no API key, no cost)
import fs from "node:fs";
import path from "node:path";
import {parsePrograms, profileUrl, reviewHtml} from "./lib/insideschools.js";
import {SOURCE_DIR, pageText, quoteFound, sha, sourceFile, sourceText} from "./lib/tag-sources.js";

const data = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../data/schools.json"), "utf8"));
async function page(url) {
  const res = await fetch(url, {headers: {"user-agent": "school data refresh"}, signal: AbortSignal.timeout(30000)});
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}
const pause = () => new Promise(r => setTimeout(r, 300));

fs.mkdirSync(SOURCE_DIR, {recursive: true});
const unread = [], lost = [];
for (const s of data.schools) {
  let profile;
  try { profile = await page(profileUrl(s.dbn)); }
  catch (e) { unread.push(`${s.short}: InsideSchools profile (${e.message}). Kept the saved text, if any.`); continue; }
  await pause();
  const evidence = Object.values(s.tag_evidence).flat();
  const urls = [...new Set([s.web, ...evidence.filter(e => e.where === "website").map(e => e.url)])];
  const pages = [];
  for (const url of urls) {
    try { pages.push({url, text: pageText(await page(url))}); }
    catch (e) { unread.push(`${s.short}: ${url} (${e.message})`); }
    await pause();
  }
  const review = pageText(reviewHtml(profile)).replace(/ ?Read more$/, "");
  const text = sourceText(s, {programs: parsePrograms(profile).programs, review, pages});
  fs.writeFileSync(sourceFile(s.dbn), text);
  for (const [tag, list] of Object.entries(s.tag_evidence)) for (const e of list)
    if (e.where !== "programs" && !quoteFound(text, e.quote)) lost.push(`${s.short}, ${tag} (${e.where}): "${e.quote}"`);
  console.log(`${s.dbn} ${s.short.padEnd(14)} ${String(text.length).padStart(6)} characters  ${sha(text)}  ${pages.length} website page(s)`);
}
if (unread.length) console.log("\nCould not read:\n- " + unread.join("\n- "));
console.log(lost.length
  ? "\nStored quotes no longer found word for word in their source. Check each one: the page may have changed, or the tag may no longer hold.\n- " + lost.join("\n- ")
  : "\nEvery stored review and website quote is still found in its source.");
process.exitCode = unread.length || lost.length ? 1 : 0;
