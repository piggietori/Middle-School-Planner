import {BY, OH, keyDate, longDate} from "../data.js";
import {match, label} from "../match.js";
import {RATING_WORDS, noteOf, hasNotes, starText} from "../plan.js";
import {st} from "../state.js";
import {ui} from "../ui.js";
import {esc, pd, daysUntil, MON, when, gcal, toast} from "../util.js";
import {noteSummary} from "./common.js";

/* My list: order, Ready for MySchools, and compare notes. */
export function msText(){return st.saved.map((d,i)=>`${i+1}. ${BY[d].name} (${d})`).join("\n")}
function msGuide(saved){
  return `<div class="card stack" id="myschools">
    <h2>Ready for MySchools</h2>
    <p style="margin:0">Open MySchools and go to <b>Build your child's application</b>. For each choice below, type the school code into <b>Search for a program to add</b> and add the program you want at that school, in this order.</p>
    <div class="row"><a class="btn primary" href="https://www.myschools.nyc/" target="_blank" rel="noopener">Open MySchools</a><button class="btn" data-copyall="1">Copy the whole list</button></div>
    <ol class="stepper">${saved.map((s,i)=>`<li class="st-item todo"><span class="st-dot" aria-hidden="true">${i+1}</span>
        <div class="st-body stack" style="gap:6px">
          <div class="st-t" style="color:var(--ink)"><span class="sr">Choice ${i+1}: </span>${esc(s.name)}</div>
          <div class="row" style="gap:8px"><span class="small">Search for</span><code class="code">${esc(s.dbn)}</code><button class="btn" data-copy="${esc(s.dbn)}">Copy</button></div>
        </div></li>`).join("")}
      <li class="st-item todo"><span class="st-dot" aria-hidden="true">→</span>
        <div class="st-body"><div class="st-t" style="color:var(--ink)">Check the order, then click Next and Submit</div>
        <div class="small muted">The numbers in MySchools should match the numbers here. If they don't, use the arrows in MySchools to move programs. Submit by ${longDate(keyDate("k-close"))}.</div></div></li>
    </ol>
    <p class="small muted" style="margin:0">If the school code doesn't find it, search the school name. Many schools have more than one program, such as a zoned program and an honors program. You can add more than one from the same school.</p>
  </div>`;
}
export function copyText(t,msg){
  const fail=()=>toast("Couldn't copy. Press and hold the text to copy it.");
  try{navigator.clipboard.writeText(t).then(()=>toast(msg),fail)}catch(e){fail()}
}
export function vList(){
  const closed=daysUntil(keyDate("k-close"))<0; // after the deadline the list is what was submitted (journey J6)
  const saved=st.saved.map(d=>BY[d]).filter(Boolean);
  const views=`<div class="seg" role="group" aria-label="View" style="max-width:340px;grid-template-columns:1fr 1fr">
      ${[["order","My order"],["compare","Compare notes"]].map(([k,l])=>`<button aria-pressed="${ui.listView===k}" data-lv="${k}">${l}</button>`).join("")}</div>`;
  if(ui.listView==="compare")return `<section class="view">
    <div><h2>Compare our notes</h2><p class="muted" style="margin:.3rem 0 0">Your own ratings and notes for each school, side by side. Highest rated first.</p></div>
    ${views}${vCompare()}</section>`;
  return `<section class="view">
    <div><h2>My list</h2><p class="small" style="margin:.3rem 0 0"><b>This list is for planning.</b> Your application counts only when you submit it in MySchools.</p><p class="muted" style="margin:.3rem 0 0">${closed?`Applications closed on ${longDate(keyDate("k-close"))}. This is your list as you submitted it.`:"Put your favorite first. This is the order to enter in MySchools. Use the arrows to move schools up or down."}</p></div>
    ${views}
    ${saved.length?`<div class="stack">${saved.map((s,i)=>{const m=match(s,st),ev=OH.filter(e=>e.dbn===s.dbn&&daysUntil(e.date)>=0);
      return `<article class="sc"><div class="sc-head">
        ${closed?"":`<div class="order"><button data-mv="${i}:-1" ${i===0?"disabled":""} aria-label="Move up">▲</button><button data-mv="${i}:1" ${i===saved.length-1?"disabled":""} aria-label="Move down">▼</button></div>`}
        <div><div class="rank">Choice ${i+1} · ${esc(s.dbn)}</div><h3 style="margin-top:2px">${esc(s.name)}</h3>
        <div class="meta"><span>${label(m.score)[0]} (${m.score} out of 100)</span>${m.dist!=null?`<span>${m.dist.toFixed(1)} mi</span>`:""}<span>${s.admit.includes("audition")?"Audition":s.admit.length===1&&s.admit[0]==="screened"?"Screened only":s.admit.includes("open")&&s.admit.length===1?"Open to all":"Zoned + other programs"}</span></div></div></div>
        ${noteSummary(s.dbn)}
        <div class="muted small">${ev.length?"Next open house: <b>"+when(ev[0])+"</b>":"No upcoming open house listed. Check the school website for tours."}</div>
        <div class="row"><button class="btn" data-open="${s.dbn}">See details</button><button class="btn" data-notes="${s.dbn}">${hasNotes(s.dbn)?"Edit our notes":"Add our notes"}</button>${ev.length?`<a class="btn" href="${gcal(ev[0])}" target="_blank" rel="noopener">Add open house to calendar</a>`:""}<button class="btn" data-save="${s.dbn}">Remove</button></div>
      </article>`}).join("")}</div>
      ${msGuide(saved)}
      <div class="card small"><b>How the ranking works:</b> NYC matches each student to the highest school on their list that has room for them. Listing more schools never lowers your chance at your first choice. Check MySchools for how many choices you can add.</div>`
    :`<div class="empty"><p style="margin:0 0 12px">Your list is empty.</p><button class="btn primary" data-tab-go="find">Find schools</button></div>`}
  </section>`;
}
function vCompare(){
  // Saved schools plus any other school you wrote notes for; best rated first, then your list order.
  const ids=[...new Set([...st.saved,...Object.keys(st.notes)])].filter(d=>BY[d]);
  if(!ids.length)return `<div class="empty"><p style="margin:0 0 12px">No schools to compare yet. Save schools, then add your notes after each open house.</p><button class="btn primary" data-tab-go="find">Find schools</button></div>`;
  const pos=d=>{const i=st.saved.indexOf(d);return i<0?99:i};
  ids.sort((a,b)=>noteOf(b).rating-noteOf(a).rating||pos(a)-pos(b));
  const top=Math.max(...ids.map(d=>noteOf(d).rating));
  const cell=(d,html)=>`<td>${html}</td>`;
  const list=(items,kind)=>items.length?`<ul class="cmp-list ${kind}">${items.map(t=>`<li>${esc(t)}</li>`).join("")}</ul>`:`<span class="muted small">Nothing yet</span>`;
  const visited=d=>{const ev=OH.filter(e=>e.dbn===d&&st.attended.includes(e.id));return ev.length?"Yes, "+MON[pd(ev[0].date).getMonth()]+" "+pd(ev[0].date).getDate():`<span class="muted">Not yet</span>`};
  const admitLabel=s=>s.admit.includes("audition")?"Audition":s.admit.every(a=>a==="screened")?"Screened only":s.admit.length===1&&s.admit[0]==="open"?"Open to all":"Zoned + other programs";
  const rows=[
    ["Our rating",d=>{const n=noteOf(d);return n.rating?`<div class="cmp-stars" aria-label="${n.rating} out of 5 stars">${starText(n.rating)}</div><div class="small" style="font-weight:700">${RATING_WORDS[n.rating]}</div>`:`<span class="muted small">Not rated</span>`}],
    ["What we like",d=>list(noteOf(d).pros,"pros")],
    ["What could be better",d=>list(noteOf(d).cons,"cons")],
    ["Visited",visited],
    ["Match",d=>{const m=match(BY[d],st);return `${label(m.score)[0]}<div class="muted small">${m.score} out of 100</div>`}],
    ["Distance",d=>{const m=match(BY[d],st);return m.dist!=null?m.dist.toFixed(1)+" mi":`<span class="muted small">Pick your neighborhood</span>`}],
    ["How to get in",d=>admitLabel(BY[d])]
  ];
  return `${ids.length>2?`<p class="muted small cmp-hint" style="margin:0">Scroll sideways to see all ${ids.length} schools.</p>`:""}
  <div class="cmp-wrap"><table class="cmp">
    <thead><tr><td class="corner"></td>${ids.map(d=>{const p=pos(d);return `<th scope="col">
      <div class="rank">${p<99?"Choice "+(p+1):"Not on my list"}${top&&noteOf(d).rating===top?` <span class="pill good">Top rated</span>`:""}</div>
      <button class="linkbtn cmp-name" data-open="${d}">${esc(BY[d].name)}</button></th>`}).join("")}</tr></thead>
    <tbody>${rows.map(([lab,f])=>`<tr><th scope="row">${lab}</th>${ids.map(d=>cell(d,f(d))).join("")}</tr>`).join("")}
      <tr><th scope="row"><span class="sr">Edit</span></th>${ids.map(d=>`<td><button class="btn" data-notes="${d}">${hasNotes(d)?"Edit notes":"Add notes"}</button></td>`).join("")}</tr>
    </tbody></table></div>`;
}
