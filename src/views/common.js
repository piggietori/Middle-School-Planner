import {BY, SOURCES, DATA_AS_OF, S, EVENTS} from "../data.js";
import {label} from "../match.js";
import {isSaved, RATING_WORDS, noteOf, hasNotes, starText} from "../plan.js";
import {st} from "../state.js";
import {esc, pd, daysUntil, MON, when, rel, gcal, fmtDay} from "../util.js";

/* Pieces shared by several views. */
export function meter(n){const [lab,cls]=label(n);
  return `<div class="match ${cls}" role="img" aria-label="${lab}: ${n} out of 100">
    <div class="match-top"><span class="match-lab">${lab}</span><span class="match-num">${n} out of 100</span></div>
    <div class="meter"><i style="width:${n}%"></i></div></div>`}
export function evRow(e,opts={}){
  const n=daysUntil(e.date), d=pd(e.date), past=n<0, sc=e.dbn&&BY[e.dbn], going=st.going.includes(e.id), went=st.attended.includes(e.id);
  const tag=went?`<span class="pill good">✓ Visited</span>`:past?`<span class="pill">Passed</span>`:n<=7?`<span class="pill leaf">${rel(n)}</span>`:`<span class="pill">${rel(n)}</span>`;
  const wentBtn=e.kind==="open"&&n<=0?`<div class="row" style="gap:8px">${going&&!went?`<span class="small" style="font-weight:700">Did you go?</span>`:""}<button class="btn${went?" on":""}" data-went="${e.id}">${went?"✓ I went":"Yes, I went"}</button></div>`:"";
  if(past&&(going||went))opts={...opts,keep:true};
  return `<div class="ev${past&&!opts.keep?" past":""}">
    <div class="cal${e.kind==="key"?" key":""}"><b>${MON[d.getMonth()]}</b><span>${d.getDate()}</span></div>
    <div class="ev-body">
      <div class="row" style="gap:8px">${tag}${e.kind==="key"?`<span class="pill key">Key date</span>`:""}${e.note?`<span class="pill warn">${esc(e.note)}</span>`:""}${e.was?`<span class="pill warn">Changed</span>`:""}${sc&&isSaved(sc.dbn)?`<span class="pill good">On my list</span>`:""}</div>
      <div class="ev-title">${sc?`<button class="linkbtn" style="padding:0;text-align:left;font-size:1rem" data-open="${sc.dbn}">${esc(sc.name)}</button>`:esc(e.title)}</div>
      <div class="muted small">${when(e)}${sc?" · "+esc(sc.addr):""}${e.text?" · "+esc(e.text):""}</div>${e.was?`
      <div class="small" style="color:var(--warn)">Moved. It was ${when({...e.was,start:e.was.start??e.start,end:e.was.end??e.end})}.</div>`:""}
      ${wentBtn}
      ${past||opts.compact?"":`<div class="row" style="gap:8px">
        ${e.kind==="open"||e.start?`<button class="btn${going?" on":""}" data-going="${e.id}">${going?"✓ I'm going":"I'm going"}</button>`:""}
        <a class="btn" href="${gcal(e)}" target="_blank" rel="noopener">Add to my calendar</a>
        ${sc&&sc.flyer?`<a class="btn" href="${sc.flyer}" target="_blank" rel="noopener">Flyer</a>`:""}
        ${e.flyer?`<a class="btn" href="${e.flyer}" target="_blank" rel="noopener">Flyer</a>`:""}
        ${sc&&sc.signup?`<a class="btn" href="${sc.signup}" target="_blank" rel="noopener">Register</a>`:""}
        ${e.link&&!e.flyer?`<a class="btn" href="${e.link}" target="_blank" rel="noopener">Open MySchools</a>`:""}
      </div>`}
    </div></div>`;
}
export function noteSummary(d){if(!hasNotes(d))return "";const n=noteOf(d),bits=[];
  if(n.rating)bits.push(`<span class="s" aria-label="${n.rating} out of 5 stars">${starText(n.rating)}</span> ${RATING_WORDS[n.rating]}`);
  if(n.pros.length)bits.push(n.pros.length+" like"+(n.pros.length>1?"s":""));
  if(n.cons.length)bits.push(n.cons.length+" to improve");
  return `<div class="ournote small"><b>Our notes:</b> ${bits.join(" · ")}</div>`}
// Short names for where data came from, for "updated on" lines.
export const sourceName=id=>(SOURCES[id]?.name||id).split(" (")[0];
// Footer on every tab: how fresh the data is and where it comes from.
export function dataFooter(){
  const used=[...new Set([...S.flatMap(s=>Object.values(s.provenance).map(p=>p.source)),...EVENTS.map(e=>e.source)])];
  return `<footer class="muted small data-foot">Data last updated ${fmtDay(DATA_AS_OF)}. Sources: ${used.map(id=>`<a href="${SOURCES[id].url}" target="_blank" rel="noopener">${esc(sourceName(id))}</a>`).join(", ")}. This is an independent tool, not an official NYC Public Schools site.</footer>`;
}
