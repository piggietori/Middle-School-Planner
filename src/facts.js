/* Number bullets for a school's Highlights and Reported concerns: pure functions of the school's numbers
   and the citywide averages. One rule and one wording for every school, so a number that earns a bullet
   at one school earns it at all of them. Hand-written highlights and concerns (data/schools.json) cover
   what numbers can't; they should not quote these numbers. */
export const MARGIN=5;   // points better or worse than citywide before a number is worth a bullet
export const LARGE=1150; // students; at or above this a school is called large
export const SMALL=650;  // students; under this a school counts as a small school

// The programs a school offers: its tags (assigned by the rules in docs/data-sources.md), plus "small",
// which is worked out from its size and never typed.
export const programsOf=s=>[...new Set([...s.tags,...(s.size<SMALL?["small"]:[])])];

const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
export function facts(s,city){
  const good=[],concerns=[];
  // higher: true when a higher number is better (feel safe), false when lower is (bullying)
  const compare=(v,c,higher,text)=>{
    if(v==null||c==null)return;
    const d=higher?v-c:c-v;
    if(d>=MARGIN)good.push(text);else if(d<=-MARGIN)concerns.push(text);
  };
  const subjects=[["math","math"],["ela","reading"]].filter(([k])=>s[k]!=null&&city[k]!=null);
  if(subjects.length)compare(mean(subjects.map(([k])=>s[k])),mean(subjects.map(([k])=>city[k])),true,
    subjects.map(([k,w])=>s[k]+"% "+w).join(", ")+" passing (citywide "+subjects.map(([k])=>city[k]+"%").join(", ")+")");
  compare(s.safe,city.safe,true,s.safe+"% of students feel safe (citywide "+city.safe+"%)");
  compare(s.bully,city.bully,false,s.bully+"% of students say bullying happens often (citywide "+city.bully+"%)");
  compare(s.teach,city.teach,true,s.teach+"% of teachers would recommend the school (citywide "+city.teach+"%)");
  if(s.size>=LARGE)concerns.push("Large school: "+s.size.toLocaleString("en-US")+" students");
  if(!s.subway.length)concerns.push("No subway nearby");
  return {good,concerns};
}
