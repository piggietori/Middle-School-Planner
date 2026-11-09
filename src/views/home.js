import {acct} from "../account.js";
import {BY, OH, EVENTS, HOMES, STEPS, keyDate, longDate} from "../data.js";
import {isSaved, hasNotes, visitProgress, testSchools, s5Skipped, stepDone} from "../plan.js";
import {isEmpty} from "../plan-model.js";
import {st} from "../state.js";
import {ui} from "../ui.js";
import {esc, daysUntil, fmtT, fmtDay, when, rel, evTitle} from "../util.js";
import {evRow} from "./common.js";

/* Home: countdown, reminders, steps, coming up. */
export function vHome(){
  const close=keyDate("k-close"), offer=keyDate("k-offer"), n=daysUntil(close);
  const up=EVENTS.filter(e=>{const d=daysUntil(e.date);return d>=0&&d<=14});
  const mine=up.filter(e=>st.going.includes(e.id)||(e.dbn&&isSaved(e.dbn))||e.kind==="key");
  const show=(mine.length?mine:up).slice(0,5);
  const doneN=STEPS.filter(stepDone).length;
  const ask=EVENTS.filter(e=>st.going.includes(e.id)&&!st.attended.includes(e.id)&&daysUntil(e.date)<0);
  // One setup tip at most: Start here on the very first visit, then Keep your plan safe once something is saved
  const tip=isEmpty(st)?`<b>Start here:</b> pick your neighborhood on <button class="linkbtn" data-tab-go="find">Find schools</button> so we can show distances.`
    :acct.status==="out"&&st.saved.length?`<b>Keep your plan safe:</b> it's only on this device right now. <button class="linkbtn" data-acct="open">Sign in</button> to save it to your account and use it on your other devices.`:"";
  // Reminders, grouped in one box
  const alerts=[];
  if(n>=0&&n<=21)alerts.push(`<b>Deadline soon:</b> only ${n} days left to submit your application in MySchools.`);
  const goingSoon=EVENTS.filter(e=>st.going.includes(e.id)&&daysUntil(e.date)>=0&&daysUntil(e.date)<=2);
  goingSoon.forEach(e=>alerts.push(`<b>Coming up:</b> ${esc(evTitle(e))} is ${rel(daysUntil(e.date)).toLowerCase()} at ${fmtT(e.start)}.`));
  ask.slice(0,3).forEach(e=>alerts.push(`<b>Did you go?</b> ${esc(evTitle(e))} was on ${when(e).split(" · ")[0]}. <button class="linkbtn" data-went="${e.id}">Yes, I went</button> &nbsp; <button class="linkbtn" data-going="${e.id}">No, I missed it</button>`));
  if(ask.length>3)alerts.push(`And ${ask.length-3} more past visits to check on <button class="linkbtn" data-tab-go="dates">Dates</button>.`);
  // Nudge: visited in the last two weeks but no notes yet
  const fresh=[...new Set(OH.filter(e=>st.attended.includes(e.id)&&daysUntil(e.date)<=0&&daysUntil(e.date)>=-14&&!hasNotes(e.dbn)).map(e=>e.dbn))];
  fresh.slice(0,3).forEach(d=>alerts.push(`<b>How was ${esc(BY[d].short)}?</b> Write down what you liked and what could be better while it's fresh. <button class="linkbtn" data-notes="${d}">Add our notes</button>`));
  return `<section class="view">
    <div class="hero">
      <div class="big">${Math.max(n,0)}</div>
      <div><h2>${n>0?"days left to apply":n===0?"Applications close today":"Applications are closed"}</h2>
      <p>Middle school applications close <b>${longDate(close,true)}</b>. Offers arrive ${longDate(offer)}.</p></div>
    </div>
    ${tip?`<div class="notice" role="status"><span aria-hidden="true">👋</span><div>${tip}</div></div>`:""}
    ${alerts.length?`<div class="notice" role="status"><span aria-hidden="true">🔔</span><div class="notice-list"><h2 class="sr">Reminders</h2>${alerts.map(a=>`<div>${a}</div>`).join("")}</div></div>`:""}
    <div class="grid2">
      <div class="card stack">
        <div class="row"><h2 style="margin-right:auto">Your steps</h2><span class="pill good">${doneN} of ${STEPS.length} done</span></div>
        ${stepper()}
      </div>
      <div class="card">
        <div class="row"><h2 style="margin-right:auto">Coming up</h2><button class="linkbtn" data-tab-go="dates">See all dates</button></div>
        <p class="muted small" style="margin:.3rem 0 0">${mine.length?"Your schools and key dates in the next two weeks.":"All open houses in the next two weeks. Save schools to see only yours."}</p>
        ${show.length?show.map(e=>evRow(e)).join(""):`<div class="empty" style="margin-top:12px">No events in the next two weeks.</div>`}
      </div>
    </div>
  </section>`;
}
const TAB_ACTION={find:"Go to Find schools",dates:"See open house dates",list:"Go to My list"};
function stepSub(s){
  const vp=visitProgress(), n=st.saved.length;
  switch(s.id){
    case "s1":{const h=HOMES.find(x=>x.id===st.home);return h?"Home: "+h.label.split(" (")[0]:"Not started"}
    case "s2":return n?n+" school"+(n>1?"s":"")+" saved":"No schools saved yet";
    case "s3":{const next=OH.find(e=>st.going.includes(e.id)&&!st.attended.includes(e.id)&&daysUntil(e.date)>=0);
      return (vp.planned?vp.went+" of "+vp.planned+" planned visits done":"No visits planned yet")+(next?" · Next: "+BY[next.dbn].short+", "+when(next).split(" · ")[0].replace(/^(\w{3})\w*/,"$1"):"")}
    case "s5":{if(!n)return "Save schools first. We'll check if any need an audition or screen.";
      const t=testSchools();
      return t.length?"Needed for: "+t.map(s=>s.short+" ("+(s.admit.includes("audition")?"audition":"screened")+")").join(", ")
        :"Skipped: none of your saved schools need an audition or screen"}
    case "s6o":return n?"Your list has "+n+" school"+(n>1?"s":""):"Save schools first";
    case "s6":return n?n+" school"+(n>1?"s":"")+" to add, in your order":"";
    case "s7":{const c=keyDate("k-close"),k=daysUntil(c);return fmtDay(c)+(k>=0?" · "+(k===0?"today":k+" day"+(k>1?"s":"")+" left"):" · closed")}
    case "s8":{const o=keyDate("k-offer"),k=daysUntil(o);return fmtDay(o)+(k>=0?" · in "+k+" days":"")}
  }
  return "";
}
function stepper(){
  const cur=STEPS.findIndex(s=>!stepDone(s)), openId=ui.openStep??(cur>=0?STEPS[cur].id:null);
  return `<ol class="stepper">${STEPS.map((s,i)=>{
    const skip=s.id==="s5"&&s5Skipped(), dn=stepDone(s), state=dn?"done":i===cur?"current":"todo", open=openId===s.id, sub=stepSub(s), auto=s.id==="s3"||skip;
    const tests=s.id==="s5"&&!skip?testSchools():[];
    return `<li class="st-item ${state}${skip?" skipped":""}">
      <span class="st-dot" aria-hidden="true">${skip?"–":dn?"✓":i+1}</span>
      <div class="st-body">
        <button class="st-head" data-ostep="${s.id}" aria-expanded="${open}">
          <span class="st-t"><span class="sr">Step ${i+1}: </span>${esc(s.t)}</span>
          ${state==="current"?`<span class="pill">You are here</span>`:skip?`<span class="pill">Skipped</span>`:dn?`<span class="pill good">Done</span>`:""}
        </button>
        ${sub?`<div class="st-sub small muted">${esc(sub)}</div>`:""}
        ${open?`<div class="st-more"><p class="small">${esc(skip?"None of the schools on your list need an audition or a screen, so you can skip this step. It comes back if you save one that does.":s.d)}</p>
          ${tests.map(t=>`<div class="req"><b>${esc(t.name)}</b> <span class="pill ${t.admit.includes("audition")?"leaf":"warn"}">${t.admit.includes("audition")?"Audition":"Screened"}</span>
            <p class="small">${esc(t.admitText)}</p>
            <div class="row" style="gap:8px"><a class="btn" href="${t.web}" target="_blank" rel="noopener">School website</a>${t.signup?`<a class="btn" href="${t.signup}" target="_blank" rel="noopener">Register</a>`:""}<button class="btn" data-open="${t.dbn}">See details</button></div></div>`).join("")}
          <div class="row" style="gap:8px">
            ${s.tab?`<button class="btn${state==="current"?" primary":""}" data-tab-go="${s.tab}">${TAB_ACTION[s.tab]}</button>`:""}
            ${s.link?`<a class="btn${state==="current"?" primary":""}" href="${s.link}" target="_blank" rel="noopener">Open MySchools</a>`:""}
            ${auto?"":`<button class="btn" data-step="${s.id}">${dn?"Undo":"Mark as done"}</button>`}
          </div></div>`:""}
      </div></li>`}).join("")}</ol>`;
}
