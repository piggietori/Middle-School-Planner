import {PROG, S, HOMES} from "./data.js";
import {miles} from "./util.js";

/* Match score: pure functions of a school and the family's plan. */
export const homePt=plan=>{const h=HOMES.find(x=>x.id===plan.home);return h?{lat:h.lat,lng:h.lng,label:h.label}:null};
const lin=(v,lo,hi)=>Math.max(0,Math.min(100,(v-lo)/(hi-lo)*100));
export function match(s,plan){
  const h=homePt(plan), c={}, why=[], warn=[];
  const dist=h?miles(h,s):null;
  if(h){const far=plan.maxMiles*1.6;c.distance=dist<=.5?100:Math.max(0,100*(1-(dist-.5)/(far-.5)))}
  const avg=[s.math,s.ela].filter(x=>x!=null);
  c.scores=avg.length?lin(avg.reduce((a,b)=>a+b)/avg.length,40,97):40; // too new for results: count as below average, not unknown
  c.safety=lin(s.safe,60,92);
  if(s.bully!=null)c.bullying=lin(80-s.bully,0,70);
  if(s.teach!=null)c.teachers=lin(s.teach,55,100);
  let tw=0,sum=0;
  for(const k in plan.w){if(c[k]!=null&&plan.w[k]>0){tw+=plan.w[k];sum+=plan.w[k]*c[k]}}
  let hits=[];
  if(plan.programs.length){hits=plan.programs.filter(p=>s.tags.includes(p)||(p==="small"&&s.size<650));tw+=2;sum+=2*(hits.length/plan.programs.length*100)}
  let score=tw?sum/tw:50;
  if(h&&dist>plan.maxMiles){score*=.75;warn.push("Farther than you want ("+dist.toFixed(1)+" mi)")}
  if(plan.needSubway&&!s.subway.length){score*=.8;warn.push("No subway nearby, bus only")}
  if(dist!=null&&dist<=plan.maxMiles)why.push(dist<.8?"Very close to home: about "+dist.toFixed(1)+" mi":"About "+dist.toFixed(1)+" mi from home");
  if(avg.length&&c.scores>=60)why.push("Strong test results: "+(s.math!=null?s.math+"% math, ":"")+s.ela+"% reading passing");
  if(s.safe>=84)why.push(s.safe+"% of students feel safe");
  if(s.bully!=null&&s.bully<50)why.push("Low bullying reports ("+s.bully+"%)");
  if(hits.length)why.push("Offers: "+hits.map(p=>PROG[p]).join(", "));
  if(plan.needSubway&&s.subway.length)why.push("Near the subway");
  if(!avg.length)warn.push("Too new for full test results");
  return {s,score:Math.round(score),dist,why:why.slice(0,3),warn};
}
export function ranked(plan,schools=S){return schools.filter(s=>!(plan.skipCompetitive&&!s.admit.some(a=>a==="zoned"||a==="open"||a==="language"))).map(s=>match(s,plan)).sort((a,b)=>b.score-a.score)}
export const label=n=>n>=78?["Great match","good"]:n>=62?["Good match","good"]:n>=48?["Possible","warn"]:["Weak match","bad"];
