import {BY, OH, keyDate, longDate} from "../data.js";
import {match, label} from "../match.js";
import {DISCLAIMER} from "../notices.js";
import {RATING_WORDS, noteOf, hasNotes, starText, testSchools} from "../plan.js";
import {st} from "../state.js";
import {ui} from "../ui.js";
import {esc, pd, daysUntil, MON, when, toast} from "../util.js";
import {noteSummary} from "./common.js";

/* My list: order, compare notes, and Apply in MySchools (the step that actually counts). */
const MS="https://www.myschools.nyc/";
export function msText(){return st.saved.map((d,i)=>`${i+1}. ${BY[d].name} (${d})`).join("\n")}
const closedNow=()=>daysUntil(keyDate("k-close"))<0;
// The family ticked "I submitted in MySchools" (step 7). The planner can't see MySchools, so it only knows what they tell it.
const submitted=()=>!!st.done.s7;
// Wherever the list is still empty: schools get here by saving them on Find schools.
const EMPTY=`<div class="empty"><p style="margin:0 0 6px"><b>No schools saved yet.</b></p><p style="margin:0 0 6px">Go to Find schools and tap <b>☆ Save</b> on each school you like.</p><p style="margin:0 0 12px">Saved schools show up here, where you put them in order and get ready to apply.</p><button class="btn primary" data-tab-go="find">Find schools</button></div>`;

// On top of My list: the planner doesn't send anything, MySchools does.
function applyBanner(){
  const close=longDate(keyDate("k-close"));
  if(closedNow())return `<div class="notice warn" role="note"><span aria-hidden="true">📌</span><div><b>Applications closed on ${close}.</b> This is your list as it was then. Didn't submit? Contact your child's school counselor or a <a href="https://www.schools.nyc.gov/enrollment/enrollment-help/family-welcome-centers" target="_blank" rel="noopener">Family Welcome Center</a>.</div></div>`;
  if(submitted())return `<div class="notice" role="note"><span aria-hidden="true">✅</span><div><b>You marked your application as submitted.</b> If you change it in MySchools before ${close}, submit it again. <button class="linkbtn" data-lv="apply">Finalize &amp; apply</button></div></div>`;
  return `<div class="notice warn" role="note"><span aria-hidden="true">📌</span><div><b>Your list doesn't count until you submit it in MySchools.</b> This planner helps you prepare. It doesn't send your application. When you've picked your schools, finalize your order and enter it in MySchools.
    <div class="row" style="margin-top:8px"><button class="btn primary" data-lv="apply">Finalize your order and apply →</button></div></div></div>`;
}

// Apply in MySchools: a checklist from logging in to the confirmation, with this list's codes in order.
function vApply(saved){
  if(!saved.length)return EMPTY;
  const close=longDate(keyDate("k-close")), closed=closedNow(), tests=testSchools(), done=submitted(), p=t=>`<p class="small" style="margin:0">${t}</p>`;
  const step=(n,title,body,isDone)=>`<li class="st-item ${isDone?"done":"todo"}"><span class="st-dot" aria-hidden="true">${isDone?"✓":n}</span>
    <div class="st-body stack" style="gap:8px"><h3 class="st-t"><span class="sr">Step ${n}: </span>${title}</h3>${body}</div></li>`;
  return `<div class="card stack" id="myschools">
    <p class="small muted" style="margin:0">${DISCLAIMER}</p>
    <ol class="stepper apply">
      ${step(1,"Finalize your order",`${p("Put your true favorite first. NYC tries your first choice first, and listing more schools never lowers your chance at it. This is the order you'll enter in MySchools.")}
        <ol class="ms-codes">${saved.map((s,i)=>`<li>${closed?"<span></span>":`<div class="order"><button data-mv="${i}:-1" ${i===0?"disabled":""} aria-label="Move ${esc(s.short)} up">▲</button><button data-mv="${i}:1" ${i===saved.length-1?"disabled":""} aria-label="Move ${esc(s.short)} down">▼</button></div>`}<span class="ms-n" aria-hidden="true">${i+1}</span><div class="stack" style="gap:6px;min-width:0">
          <div><span class="sr">Choice ${i+1}: </span>${esc(s.name)}</div>
          <div class="row" style="gap:8px"><span class="small">Search for</span><code class="code">${esc(s.dbn)}</code><button class="btn" data-copy="${esc(s.dbn)}">Copy</button></div></div></li>`).join("")}</ol>
        <div class="row"><button class="btn" data-copyall="1">Copy the whole list</button></div>`)}
      ${step(2,"Open MySchools and log in",`<div class="row"><a class="btn primary" href="${MS}" target="_blank" rel="noopener">Open MySchools</a></div>
        <p class="small muted" style="margin:0">New to MySchools? Ask your child's current school for an account creation code. It can take a few days, so ask early.</p>`)}
      ${step(3,"Add your schools, in this order",`${p("Go to <b>Build your child's application</b>. For each school in step 1, type its code into <b>Search for a program to add</b>, then add the program you want.")}
        <p class="small muted" style="margin:0">If the code doesn't find it, search the school name. Many schools have more than one program, such as a zoned program and an honors program. You can add more than one from the same school.</p>
        ${tests.length?p(`<b>Auditions and screens:</b> ${tests.map(t=>esc(t.short)).join(", ")} ${tests.length>1?"have":"has"} extra steps and dates. Check them in MySchools and on the school's website.`):""}`)}
      ${step(4,"Check the order, then click Next and Submit",p(`The numbers in MySchools should match your order in step 1. If they don't, use the arrows in MySchools to move programs. Submit by <b>${close}</b>.`))}
      ${step(5,"Look for the confirmation",p("MySchools shows that your application was submitted. Take a screenshot to keep. If you change anything later, submit again."))}
      ${step(6,"Mark it done here",`${p("So the planner knows, and stops reminding you.")}
        <div class="row"><button class="btn${done?" on":" primary"}" data-submitted="1" aria-pressed="${done}">${done?"✓ I submitted in MySchools":"I submitted in MySchools"}</button></div>`,done)}
    </ol>
  </div>`;
}
export function copyText(t,msg){
  const fail=()=>toast("Couldn't copy. Press and hold the text to copy it.");
  try{navigator.clipboard.writeText(t).then(()=>toast(msg),fail)}catch(e){fail()}
}
export function vList(){
  const closed=closedNow(); // after the deadline the list is read-only (journey J6)
  const saved=st.saved.map(d=>BY[d]).filter(Boolean);
  const views=`<div class="seg" role="group" aria-label="View" style="max-width:480px">
      ${[["order","My order"],["compare","Compare notes"],["apply","Finalize & apply"]].map(([k,l])=>`<button aria-pressed="${ui.listView===k}" data-lv="${k}">${l}</button>`).join("")}</div>`;
  if(ui.listView==="compare")return `<section class="view">
    <div><h2>Compare our notes</h2><p class="muted" style="margin:.3rem 0 0">Your own ratings and notes for each school, side by side, in your order. Use ◀ ▶ to move a school earlier or later.</p></div>
    ${views}${vCompare()}</section>`;
  if(ui.listView==="apply")return `<section class="view">
    <div><h2>Finalize and apply</h2><p class="muted" style="margin:.3rem 0 0">Make your order final here, then enter it in MySchools. Your application counts only when you submit it there.</p></div>
    ${views}${closed?applyBanner():""}${vApply(saved)}</section>`;
  return `<section class="view">
    <div><h2>My list</h2><p class="muted" style="margin:.3rem 0 0">${closed?"Your list as it was when applications closed.":"Put your favorite first. This is the order to enter in MySchools. Use the arrows to move schools up or down."}</p></div>
    ${applyBanner()}
    ${views}
    ${saved.length?`<div class="stack">${saved.map((s,i)=>{const m=match(s,st),ev=OH.filter(e=>e.dbn===s.dbn&&daysUntil(e.date)>=0);
      return `<article class="sc"><div class="sc-head">
        ${closed?"":`<div class="order"><button data-mv="${i}:-1" ${i===0?"disabled":""} aria-label="Move up">▲</button><button data-mv="${i}:1" ${i===saved.length-1?"disabled":""} aria-label="Move down">▼</button></div>`}
        <div><div class="rank">Choice ${i+1} · ${esc(s.dbn)}</div><h3 style="margin-top:2px">${esc(s.name)}</h3>
        <div class="meta"><span>${label(m.score)[0]} (${m.score} out of 100)</span>${m.dist!=null?`<span>${m.dist.toFixed(1)} mi</span>`:""}<span>${s.admit.includes("audition")?"Audition":s.admit.length===1&&s.admit[0]==="screened"?"Screened only":s.admit.includes("open")&&s.admit.length===1?"Open to all":"Zoned + other programs"}</span></div></div></div>
        ${noteSummary(s.dbn)}
        <div class="muted small">${ev.length?"Next open house: <b>"+when(ev[0])+"</b>":"No upcoming open house listed. Check the school website for tours."}</div>
        <div class="row"><button class="btn" data-open="${s.dbn}">See details</button>${closed?"":`<button class="linkbtn" data-save="${s.dbn}">Remove</button>`}</div>
      </article>`}).join("")}</div>
      <div class="card small"><b>How the ranking works:</b> NYC matches each student to the highest school on their list that has room for them. Listing more schools never lowers your chance at your first choice. Check MySchools for how many choices you can add.</div>`
    :EMPTY}
  </section>`;
}
function vCompare(){
  // Saved schools plus any other school you wrote notes for; best rated first, then your list order.
  const ids=[...new Set([...st.saved,...Object.keys(st.notes)])].filter(d=>BY[d]);
  if(!ids.length)return EMPTY;
  const pos=d=>{const i=st.saved.indexOf(d);return i<0?99:i}, closed=closedNow();
  ids.sort((a,b)=>pos(a)-pos(b)); // the same order as My order; moving a column here moves it there
  const move=d=>{const i=st.saved.indexOf(d);return !closed&&i>=0?`<div class="cmp-move"><button data-mv="${i}:-1" ${i===0?"disabled":""} aria-label="Move ${esc(BY[d].short)} earlier">◀</button><button data-mv="${i}:1" ${i===st.saved.length-1?"disabled":""} aria-label="Move ${esc(BY[d].short)} later">▶</button></div>`:""};
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
  // Say where each school sits on the list, since the columns may be sorted by rating.
  return `${ids.length>2?`<p class="muted small cmp-hint" style="margin:0">Scroll sideways to see all ${ids.length} schools.</p>`:""}
  <div class="cmp-wrap"><table class="cmp">
    <thead><tr><td class="corner"></td>${ids.map(d=>{const p=pos(d);return `<th scope="col">
      <div class="rank">${p<99?"#"+(p+1)+" on my list":"Not on my list"}${top&&noteOf(d).rating===top?` <span class="pill good">Top rated</span>`:""}</div>
      <button class="linkbtn cmp-name" data-open="${d}">${esc(BY[d].name)}</button>${move(d)}</th>`}).join("")}</tr></thead>
    <tbody>${rows.map(([lab,f])=>`<tr><th scope="row">${lab}</th>${ids.map(d=>cell(d,f(d))).join("")}</tr>`).join("")}
      <tr><th scope="row"><span class="sr">Edit</span></th>${ids.map(d=>`<td><button class="btn" data-notes="${d}">${hasNotes(d)?"Edit notes":"Add notes"}</button></td>`).join("")}</tr>
    </tbody></table></div>`;
}
