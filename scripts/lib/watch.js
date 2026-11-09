// Fingerprints for the source pages we watch (scripts/watch-sources.js). A page counts as changed when
// its visible text or the files it links to (flyers, PDFs) change, not when its markup or tracking codes do.
import crypto from "node:crypto";

const ENTITIES = {amp: "&", lt: "<", gt: ">", quot: "\"", "#39": "'", nbsp: " "};

export function pageText(html) {
  return html.replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e) => ENTITIES[e])
    .replace(/\s+/g, " ").trim();
}

// Links to files, unwrapped from Google's redirect links, without the codes that change on every visit.
export function pageFiles(html) {
  const out = new Set();
  for (const [, raw] of html.matchAll(/href="([^"]+)"/g)) {
    let u = raw.replace(/&amp;/g, "&");
    try {
      const url = new URL(u, "https://example.invalid");
      if (url.hostname === "www.google.com" && url.pathname === "/url" && url.searchParams.get("q")) u = url.searchParams.get("q");
    } catch { continue; }
    const drive = u.match(/(?:drive|docs)\.google\.com\/(?:file|document|presentation|spreadsheets)\/d\/([\w-]+)/);
    if (drive) out.add(`google-file:${drive[1]}`);
    else if (/\.(pdf|xlsx?|docx?)(\?|$)/i.test(u)) out.add(u);
  }
  return [...out].sort();
}

export const fingerprint = html =>
  crypto.createHash("sha256").update(pageText(html) + "\n" + pageFiles(html).join("\n")).digest("hex").slice(0, 16);

// NYC Open Data datasets are watched through their "last updated" date instead of the page.
export const openDataId = url => url.match(/data\.cityofnewyork\.us\/d\/([a-z0-9]{4}-[a-z0-9]{4})/)?.[1];
