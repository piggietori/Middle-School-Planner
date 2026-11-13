// The text a music, arts or science & tech tag can rest on, per school: its InsideSchools program list and
// review, and pages of its own website. Saved by scripts/fetch-tag-sources.js into .cache/tag-sources/
// (not in the repository: the reviews are InsideSchools' writing) and read by the classifier and its eval.
import {createHash} from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const SOURCE_DIR = path.resolve(import.meta.dirname, "../../.cache/tag-sources");
export const sourceFile = dbn => path.join(SOURCE_DIR, `${dbn}.txt`);
export const PAGE_LIMIT = 15000; // characters kept from one web page

const NAMED = {amp: "&", nbsp: " ", quot: '"', apos: "'", lt: "<", gt: ">", ldquo: '"', rdquo: '"', lsquo: "'", rsquo: "'", mdash: "—", ndash: "–", hellip: "…"};
const entities = t => t
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);

// One spelling for quote marks and spaces, so a quote copied from a page is found in it again.
export const plain = t => t.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();

// A web page as plain text: no scripts, styles or tags. Entities are decoded twice because some school
// sites double-encode them.
export const pageText = html => plain(entities(entities(
  html.replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " "))));

// The text handed to the classifier for one school. pages: [{url, text}]
export function sourceText(school, {programs, review, pages}) {
  return [
    `SCHOOL: ${school.name} (${school.dbn}), grades ${school.grades}`,
    "",
    "== InsideSchools program list ==",
    programs.length ? programs.map(p => `- ${p.name}${p.method ? ` (admissions: ${p.method})` : ""}`).join("\n") : "(no programs listed)",
    "",
    "== InsideSchools review ==",
    review || "(none)",
    ...pages.flatMap(p => ["", `== School website: ${p.url} ==`, p.text.slice(0, PAGE_LIMIT) || "(empty page)"]),
  ].join("\n") + "\n";
}

export const sha = text => createHash("sha256").update(text).digest("hex").slice(0, 12);
export function loadSource(dbn) {
  const f = sourceFile(dbn);
  if (!fs.existsSync(f)) throw new Error(`No saved source text for ${dbn}. Run: npm run fetch:tag-sources`);
  return fs.readFileSync(f, "utf8");
}
// Is this quote in the text, word for word (spaces and quote marks aside)?
export const quoteFound = (text, quote) => plain(quote).length >= 3 && plain(text).includes(plain(quote));
