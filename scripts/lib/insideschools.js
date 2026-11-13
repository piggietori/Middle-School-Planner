// Read the numbers we take from an InsideSchools school profile (insideschools.org/school/<DBN>):
// three NYC School Survey answers with their citywide averages, enrollment, and the program list.
// A question the page doesn't show comes back as null. A page we can't read at all throws, so a
// change to their layout is never mistaken for "no data".
const text = html => html.replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const div = name => `<div class=['"]${name}['"]>([\\s\\S]*?)</div>`;
const STAT = new RegExp(`${div("stat-title")}\\s*${div("stat-value")}(?:\\s*${div("stat-caption")})?`, "g");

const QUESTIONS = {
  safe: /students say they feel safe/i,
  bully: /students think bullying happens most or all of the time/i,
  teach: /teachers say they would recommend this school/i,
};
const pct = s => { const m = s?.match(/(\d{1,3})%/); return m ? +m[1] : null; };

export const profileUrl = dbn => `https://insideschools.org/school/${dbn}`;

export function parseProfile(html) {
  const stats = [...html.matchAll(STAT)].map(m => ({title: text(m[1]), value: text(m[2]), caption: m[3] ? text(m[3]) : ""}));
  const year = html.match(/From the (\d{4})-(\d{2,4}) NYC School Survey/);
  if (!stats.length || !year) throw new Error("the page has no NYC School Survey section we can read (has the layout changed?)");
  const out = {period: `${year[1]}-${year[2].slice(-2)}`, city: {}};
  for (const [k, re] of Object.entries(QUESTIONS)) {
    const s = stats.find(x => re.test(x.title));
    out[k] = pct(s?.value);
    out.city[k] = /citywide average/i.test(s?.caption ?? "") ? pct(s.caption) : null;
  }
  const enrolled = stats.find(x => /^enrollment$/i.test(x.title))?.value.replace(/,/g, "");
  out.size = /^\d+$/.test(enrolled ?? "") ? +enrolled : null;
  return out;
}

// The programs under "Programs & Admissions" (each with its admissions method) and whether the page carries
// the "Staff Pick for Special Ed" mark. Program tags rest on these (docs/data-sources.md, Program tags).
// A school with no listed programs comes back with an empty list.
const PROGRAM = new RegExp(`${div("program-title")}\\s*(?:${div("program-underline")})?`, "g");
export function parsePrograms(html) {
  const programs = [...html.matchAll(PROGRAM)].map(m => ({name: text(m[1]), method: text(m[2] ?? "").replace(/^Admissions Method:\s*/i, "")}));
  return {programs, staff_pick_sped: /is-pick-special-ed/.test(html)};
}

// The "Our Insights" section: InsideSchools' own takeaways and written review, as HTML. Empty when the page
// has none. Schools without a visit carry a short standard text here instead of a review.
export function reviewHtml(html) {
  const m = html.match(/<h2 class=['"]school-heading['"]>Our Insights<\/h2>([\s\S]*?)<h2 class=['"]school-heading['"]>/);
  return m ? m[1] : "";
}
