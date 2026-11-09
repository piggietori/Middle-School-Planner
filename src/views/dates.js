import {BY, EVENTS} from "../data.js";
import {isSaved} from "../plan.js";
import {st} from "../state.js";
import {ui} from "../ui.js";
import {esc, today, pd, daysUntil, MON, DOW, fmtDay} from "../util.js";
import {evRow} from "./common.js";

/* Dates: open houses and key dates, as a calendar or a list. */
export function vDates(){
  let list=EVENTS;
  if(ui.dateFilter==="mine")list=EVENTS.filter(e=>e.kind==="key"||(e.dbn&&isSaved(e.dbn)));
  if(ui.dateFilter==="going")list=EVENTS.filter(e=>st.going.includes(e.id));
  const upcoming=list.filter(e=>daysUntil(e.date)>=0), past=list.filter(e=>daysUntil(e.date)<0);
  let html="",last="";
  for(const e of upcoming){const d=pd(e.date),m=MON[d.getMonth()]+" "+d.getFullYear();if(m!==last){html+=`<div class="month">${["January","February","March","April","May","June","July","August","September","October","November","December"][d.getMonth()]} ${d.getFullYear()}</div>`;last=m}html+=evRow(e)}
  return `<section class="view">
    <div><h2>Open houses & key dates</h2><p class="muted" style="margin:.3rem 0 0">Tap <b>Add to my calendar</b> to get a reminder on your phone. Tap <b>I'm going</b> to see reminders here.</p></div>
    <div class="row" style="justify-content:space-between">
      <div class="chips" role="group" aria-label="Show">
        ${[["all","All dates"],["mine","My schools"],["going","I'm going"]].map(([k,l])=>`<button class="chip" aria-pressed="${ui.dateFilter===k}" data-df="${k}">${l}</button>`).join("")}
      </div>
      <div class="seg" role="group" aria-label="View" style="min-width:220px">
        ${[["cal","Calendar"],["list","List"]].map(([k,l])=>`<button aria-pressed="${ui.dateView===k}" data-dv="${k}">${l}</button>`).join("")}
      </div>
    </div>
    ${ui.dateView==="cal"?vCal(list):`<div class="card">${upcoming.length?html:`<div class="empty">${ui.dateFilter==="going"?"You haven't marked any open houses yet. Tap “I'm going” on a date.":"Save schools on Find schools to see their dates here."}</div>`}
      ${past.length?`<details style="margin-top:10px"><summary>Show ${past.length} past date${past.length>1?"s":""}</summary>${past.map(e=>evRow(e)).join("")}</details>`:""}
    </div>`}
    <p class="muted small">Dates from the District 20 Middle School Open House flyer. Schools sometimes change times, so check the flyer before you go. Last updated ${fmtDay(EVENTS.map(e=>e.as_of).sort().at(-1))}.</p>
  </section>`;
}
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
export const CAL_RANGE=[[2026,9],[2026,10],[2026,11],[2027,0],[2027,1],[2027,2],[2027,3]]; // Oct 2026 – Apr 2027
const iso=(y,m,d)=>y+"-"+String(m+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
function vCal(list){
  if(ui.calMonth==null){const t=today();ui.calMonth=Math.max(0,CAL_RANGE.findIndex(([y,m])=>y===t.getFullYear()&&m===t.getMonth()))}
  const [y,m]=CAL_RANGE[ui.calMonth], first=new Date(y,m,1).getDay(), days=new Date(y,m+1,0).getDate(), tIso=(t=>iso(t.getFullYear(),t.getMonth(),t.getDate()))(today());
  const inMonth=list.filter(e=>e.date.startsWith(iso(y,m,1).slice(0,7)));
  if(!ui.selDay||!ui.selDay.startsWith(iso(y,m,1).slice(0,7))){const nx=inMonth.find(e=>e.date>=tIso)||inMonth[0];ui.selDay=nx?nx.date:null}
  let cells=Array.from({length:first},()=>`<div class="day blank" aria-hidden="true"></div>`).join("");
  for(let d=1;d<=days;d++){
    const ds=iso(y,m,d), ev=inMonth.filter(e=>e.date===ds);
    const cls=e=>e.kind==="key"?"key":st.going.includes(e.id)?"go":"";
    const name=e=>e.kind==="key"?e.title:BY[e.dbn].short;
    const inner=`<span class="n">${d}</span>
      <span class="dots">${ev.map(e=>`<i class="${cls(e)}"></i>`).join("")}</span>
      ${ev.slice(0,2).map(e=>`<span class="lbl ${cls(e)}">${esc(name(e))}</span>`).join("")}${ev.length>2?`<span class="lbl more">+${ev.length-2} more</span>`:""}`;
    cells+=ev.length?`<button class="day has${ds===tIso?" today":""}${ds<tIso?" gone":""}" aria-pressed="${ui.selDay===ds}" data-day="${ds}" aria-label="${MONTHS[m]} ${d}: ${ev.length} event${ev.length>1?"s":""}">${inner}</button>`
      :`<div class="day${ds===tIso?" today":""}${ds<tIso?" gone":""}">${inner}</div>`;
  }
  const sel=ui.selDay?list.filter(e=>e.date===ui.selDay):[];
  return `<div class="card stack">
    <div class="row" style="justify-content:space-between">
      <button class="btn" data-cm="-1" ${ui.calMonth===0?"disabled":""} aria-label="Previous month">‹</button>
      <h3 style="font-size:1.2rem">${MONTHS[m]} ${y}</h3>
      <button class="btn" data-cm="1" ${ui.calMonth===CAL_RANGE.length-1?"disabled":""} aria-label="Next month">›</button>
    </div>
    <div class="calgrid">${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(x=>`<div class="dow">${x}</div>`).join("")}${cells}</div>
    <div class="legend small muted"><span><i></i>Open house</span><span><i class="go"></i>I'm going</span><span><i class="key"></i>Key date (deadline or district event)</span><span><b class="today-chip">${today().getDate()}</b>Today</span><span><b class="sel-chip"></b>Selected day</span></div>
  </div>
  <div class="card">${sel.length?`<h3>${(d=>DOW[d.getDay()]+", "+MONTHS[d.getMonth()]+" "+d.getDate())(pd(ui.selDay))}</h3>${sel.map(e=>evRow(e)).join("")}`
    :`<div class="empty">${inMonth.length?"Tap a highlighted day to see its events.":"No events this month"+(ui.dateFilter!=="all"?" for this filter.":".")}</div>`}</div>`;
}
