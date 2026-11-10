// Every version has its notes: CHANGELOG.md must have a non-empty section for the version in package.json.
//   node scripts/check-changelog.js                 check (CI runs this on every pull request)
//   node scripts/check-changelog.js --notes v1.1.1  print that version's section (the release workflow uses it)
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8").replace(/\r\n/g, "\n");
const {version} = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

// The text under "## [version] - date", up to the next version heading or the link list at the bottom.
export function section(v) {
  const lines = changelog.split("\n"), start = lines.findIndex(l => l.startsWith(`## [${v}]`));
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && (l.startsWith("## [") || /^\[[^\]]+\]: /.test(l)));
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n").trim();
}

if (process.argv[1] === import.meta.filename) {
  const i = process.argv.indexOf("--notes");
  if (i > 0) {
    const v = (process.argv[i + 1] || "").replace(/^v/, ""), notes = section(v);
    if (!notes) { console.error(`CHANGELOG.md has no notes for ${v}.`); process.exit(1); }
    console.log(notes);
  } else {
    const notes = section(version);
    if (notes === null) { console.error(`CHANGELOG.md has no "## [${version}]" section for package.json's version. Add one with what changed.`); process.exit(1); }
    if (!notes) { console.error(`CHANGELOG.md's section for ${version} is empty. Say what changed.`); process.exit(1); }
    console.log(`CHANGELOG.md has notes for ${version}.`);
  }
}
