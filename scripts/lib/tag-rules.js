// The three program tags that rest on a school's InsideSchools program list, as code. The rules in words are in
// docs/data-sources.md (Program tags). Music, arts and science & tech rest on written text and are not decided here.
const SPECIALIZED = /\b(ASD|ACES|Nest|Horizon|D75)\b/i;

export const STAFF_PICK = "Staff Pick for Special Ed";
export const LIST_TAGS = ["honors", "language", "sped"];

// Which listed programs support each tag. listed: {programs: [{name, method}], staff_pick_sped}
export function listEvidence(listed) {
  const names = test => listed.programs.filter(test).map(p => p.name);
  return {
    honors: names(p => /^screened/i.test(p.method)),
    language: names(p => /dual language/i.test(p.name) || /^language/i.test(p.method)),
    sped: [...names(p => SPECIALIZED.test(p.name) || SPECIALIZED.test(p.method)), ...(listed.staff_pick_sped ? [STAFF_PICK] : [])],
  };
}
export const listTags = listed => LIST_TAGS.filter(t => listEvidence(listed)[t].length);

// The three tags that rest on written text (a review, a school's website). No rule in code decides them:
// a person does, or the classifier in scripts/lib/tag-classifier.js proposes. These are the rules in words,
// word for word as in docs/data-sources.md (a unit test keeps the two the same).
export const PROSE_TAGS = ["music", "arts", "stem"];
export const PROSE_RULES = {
  music: "a band, orchestra, chorus or music major is named",
  arts: "an arts academy or major is named, or at least two of visual art, theater and dance",
  stem: "a science or tech academy, lab, or class beyond the core is named (coding, robotics, flight simulation). A Federal Magnet program alone doesn't count: it is a diversity lottery",
};
