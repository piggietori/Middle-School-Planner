/* Signing in, and keeping the plan in sync with the account (journeys J2 and J3 in docs/journeys.md).
   Signed out, nothing here loads or runs: the plan stays on this device, exactly as before. */
import {SESSION_KEY} from "./config.js";
import {CYCLE} from "./data.js";
import {toRows, fromRows, diffRows, isNoop, isEmpty, mergePlans} from "./plan-model.js";
import {render} from "./render.js";
import {st, replacePlan} from "./state.js";
import {$, esc, toast} from "./util.js";

export const acct = {status:"out", email:"", userId:"", sent:"", lastEmail:"", saving:"saved", open:false, error:""};
let backend=null, planId=null, synced=null, timer=null, busy=null, warned=false;

const store = {
  get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},
  set:(k,v)=>{try{v?localStorage.setItem(k,v):localStorage.removeItem(k)}catch(e){}},
};
const UNSYNCED="d20plan-unsynced"; // this device has changes the account doesn't have yet
const OWNER="d20plan-user";        // whose account the plan on this device was last synced with

async function getBackend(){
  if(!backend){const {createBackend}=await import("./sync/backend.js");backend=await createBackend();backend.onChange(onAuth)}
  return backend;
}

export async function initAccount(){
  addEventListener("online",()=>acct.status==="error"?retry():flush());
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refresh()});
  const hash=new URLSearchParams(location.hash.slice(1));
  if(hash.has("error_description")){ // an expired or already-used sign-in link
    history.replaceState(null,"",location.pathname+location.search);
    acct.error="That sign-in link has expired or was already used. Send yourself a new one.";
    acct.open=true;
  }
  const returning=hash.has("access_token");
  if(!returning&&!store.get(SESSION_KEY)&&!window.__plannerTestBackend)return renderAccount();
  try{
    const s=await (await getBackend()).session();
    if(s)await signedIn(s);else renderAccount();
  }catch(e){console.error(e);renderAccount()}
}

function onAuth(event,session){
  if(event==="SIGNED_IN"&&session)signedIn(session);
  if(event==="SIGNED_OUT"&&acct.status!=="out")signedOut();
}

let lastSession=null;
async function signedIn(session){
  // A sign-in link can report the same session twice (from the link, then from storage); load once.
  if(session.user.id===acct.userId&&(acct.status==="loading"||acct.status==="in"))return;
  lastSession=session;
  acct.status="loading";acct.email=session.user.email||"";acct.userId=session.user.id;acct.error="";acct.sent="";
  renderAccount();
  try{
    planId=await backend.openPlan(CYCLE);
    const remote=fromRows(await backend.load(planId)), local=st;
    // New to this device, or changed here while offline: combine. Otherwise the account has the latest plan.
    const firstHere=store.get(OWNER)!==session.user.id, combine=firstHere||store.get(UNSYNCED)==="1";
    synced=toRows(remote);
    replacePlan(combine?mergePlans(remote,local):remote);
    store.set(OWNER,session.user.id);
    acct.status="in";
    render();renderAccount();
    await flush();
    if(firstHere)toast(isEmpty(local)?"Signed in. Your plan is loaded.":isEmpty(remote)?"Signed in. Your plan is saved to your account.":"Signed in. We added this device's plan to your account.");
  }catch(e){
    console.error(e);acct.status="error";renderAccount();
    toast("Couldn't reach your account. Your plan is still saved on this device.");
  }
}
const retry=()=>lastSession&&signedIn(lastSession);

function signedOut(){
  acct.status="out";acct.email="";acct.userId="";planId=null;synced=null;
  store.set(UNSYNCED,"");store.set(OWNER,"");
  renderAccount();render();
}

// Called on every change to the plan (state.js persist).
export function queueSync(){
  if(acct.status!=="in")return;
  store.set(UNSYNCED,"1");setSaving("saving");
  clearTimeout(timer);timer=setTimeout(flush,700);
}

async function flush(){
  if(acct.status!=="in")return;
  while(busy)await busy; // one save at a time
  const next=toRows(st), d=diffRows(synced,next);
  if(isNoop(d)){store.set(UNSYNCED,"");return setSaving("saved")}
  setSaving("saving");
  busy=backend.save(planId,d).then(()=>{
    synced=next;warned=false;
    if(isNoop(diffRows(synced,toRows(st)))){store.set(UNSYNCED,"");setSaving("saved")}
  },e=>{
    console.error(e);setSaving("failed");
    if(!warned){warned=true;toast("Couldn't save to your account. We'll keep trying. Your plan is safe on this device.")}
  });
  await busy;busy=null;
}

// Pick up changes made on another device when this tab comes back into view (journey J3).
async function refresh(){
  if(acct.status!=="in")return;
  if(store.get(UNSYNCED)==="1")return flush();
  try{
    const rows=toRows(fromRows(await backend.load(planId)));
    if(JSON.stringify(rows)===JSON.stringify(synced)||store.get(UNSYNCED)==="1")return;
    synced=rows;replacePlan(fromRows(rows));render();
  }catch(e){console.error(e)}
}

export async function sendLink(email){
  acct.lastEmail=email;
  try{
    await (await getBackend()).sendLink(email);
    acct.sent=email;acct.error="";
  }catch(e){
    console.error(e);
    acct.error=/rate limit|too many/i.test(e.message||"")?"Too many sign-in emails were sent. Wait a few minutes, then try again."
      :"Couldn't send the email. Check the address and your connection, then try again.";
  }
  renderAccount();
}

export async function signOut(){
  clearTimeout(timer);await flush();
  try{await backend.signOut()}catch(e){console.error(e)}
  signedOut();acct.open=false;renderAccount();
  toast("Signed out. Your plan is still on this device.");
}

/* ---------------- ACCOUNT UI ---------------- */
const SAVING={saving:"Saving…",saved:"✓ All changes saved to your account",failed:"Couldn't save. We'll try again when you're back online."};
function setSaving(s){acct.saving=s;if(acct.open)renderAccount()}

function sheetBody(){
  if(acct.status==="in")return `<h2>Your account</h2>
    <p style="margin:0">Signed in as <b>${esc(acct.email)}</b>. Your plan is saved to your account and stays the same on every device where you sign in.</p>
    <p class="small" role="status" style="margin:0;color:var(--${acct.saving==="failed"?"bad":acct.saving==="saved"?"good":"muted"})">${SAVING[acct.saving]}</p>
    <div class="row"><button class="btn" data-acct="signout">Sign out on this device</button></div>`;
  if(acct.status==="loading")return `<h2>Signing in…</h2><p class="muted" style="margin:0">Loading your plan.</p>`;
  if(acct.sent)return `<h2>Check your email</h2>
    <p style="margin:0">We sent a sign-in link to <b>${esc(acct.sent)}</b>. Open it on this device or any other to sign in. It works once and expires in an hour.</p>
    <p class="muted small" style="margin:0">No email? Check your spam folder, or <button class="linkbtn" data-acct="again">send it again</button>.</p>`;
  return `<h2>Keep your plan on all your devices</h2>
    <p style="margin:0">Sign in to save your schools, visits and notes to your account. We'll email you a link. There's no password.</p>
    ${acct.status==="error"?`<div class="notice" role="alert"><div>Couldn't reach your account. Your plan is still saved on this device. <button class="linkbtn" data-acct="retry">Try again</button></div></div>`:""}
    ${acct.error?`<div class="notice" role="alert"><div>${esc(acct.error)}</div></div>`:""}
    <form class="stack" style="gap:8px" data-acct-form="1">
      <label for="acct-email" class="lab">Email</label>
      <input id="acct-email" type="email" autocomplete="email" required maxlength="254" value="${esc(acct.lastEmail)}" placeholder="you@example.com">
      <button class="btn primary" type="submit">Email me a sign-in link</button>
    </form>
    <p class="muted small" style="margin:0">Signing in is optional. Your plan always stays on this device too.</p>`;
}

export function renderAccount(){
  const b=$("#acct");
  if(b)b.innerHTML=acct.status==="in"
    ?`<button class="btn acct-btn" data-acct="open" aria-label="Account: ${esc(acct.email)}"><span class="acct-dot" aria-hidden="true">${esc((acct.email[0]||"?").toUpperCase())}</span><span class="acct-label">Account</span></button>`
    :`<button class="btn acct-btn" data-acct="open"${acct.status==="loading"?' aria-busy="true"':""}><svg class="acct-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg><span class="acct-label">${acct.status==="loading"?"Signing in…":"Sign in"}</span></button>`;
  const s=$("#acctsheet");
  if(!s)return;
  const typed=document.getElementById("acct-email")?.value; // keep what's being typed across re-renders
  s.innerHTML=acct.open?`<div class="sheet" data-acct="close"><div class="sheet-in acct-sheet" role="dialog" aria-modal="true" aria-label="Account">
    <div class="sheet-bar"><button class="btn" data-acct="close">← Back</button></div><div class="stack">${sheetBody()}</div></div></div>`:"";
  const input=document.getElementById("acct-email");
  if(input&&typed!=null)input.value=typed;
}

document.addEventListener("click",e=>{
  const t=e.target.closest("[data-acct]");
  if(!t)return;
  const a=t.dataset.acct;
  if(a==="close"&&e.target!==t&&!e.target.closest("button[data-acct]"))return; // clicks inside the sheet
  if(a==="open"){acct.open=true;renderAccount();document.getElementById("acct-email")?.focus()}
  if(a==="close"){acct.open=false;renderAccount()}
  if(a==="again"){acct.sent="";renderAccount();document.getElementById("acct-email")?.focus()}
  if(a==="retry")retry();
  if(a==="signout")signOut();
});
document.addEventListener("submit",e=>{
  if(!e.target.dataset.acctForm)return;
  e.preventDefault();
  const email=document.getElementById("acct-email").value.trim();
  if(email)sendLink(email);
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&acct.open){acct.open=false;renderAccount()}});
