/* Signing in, keeping the plan in sync with the account, and leaving (journeys J2, J3 and J7 in docs/journeys.md).
   Signed out, nothing here loads or runs: the plan stays on this device, exactly as before. */
import {PILOT, SESSION_KEY} from "./config.js";
import {CYCLE} from "./data.js";
import {feedbackButton} from "./feedback.js"; // a sign-in failure isn't logged (signed out), so let them tell us
import {reportError, setLogging, takeLogs, track} from "./log.js";
import {CHILD_KEYS, toRows, fromRows, diffRows, isNoop, isEmpty, mergePlans} from "./plan-model.js";
import {render} from "./render.js";
import {applyRemoteSession, forgetSession} from "./session.js";
import {st, replacePlan} from "./state.js";
import {ui} from "./ui.js";
import {$, esc, toast} from "./util.js";

export const acct = {status:"out", email:"", userId:"", sent:"", lastEmail:"", saving:"saved", open:false, error:"", ask:"", deleting:false, lost:"", codeBusy:false};
let backend=null, planId=null, synced=null, timer=null, busy=null, warned=false, sessionTimer=null, sessionNext=null, logTimer=null, opened=false, leaving=false;

const store = {
  get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},
  set:(k,v)=>{try{v?localStorage.setItem(k,v):localStorage.removeItem(k)}catch(e){}},
};
const UNSYNCED="d20plan-unsynced"; // this device has changes the account doesn't have yet
const OWNER="d20plan-user";        // whose account the plan on this device was last synced with
const EMAIL="d20plan-email";       // the account this device signed in to; forgotten only when the family signs out
const PENDING="d20plan-pending";   // {email, at}: a sign-in email sent from here in the last hour, so its code box
                                   // survives the page reloading (phones often reload it while you read your email)
const CODE_LIFE=30*60e3;           // as long as the code works: Supabase → Email OTP Expiration (1800 seconds)
function setPending(email){store.set(PENDING,email?JSON.stringify({email,at:Date.now()}):"")}
function pendingEmail(){
  try{const p=JSON.parse(store.get(PENDING)||"null");return p&&Date.now()-p.at<CODE_LIFE?p.email:""}catch(e){return ""}
}

async function getBackend(){
  if(!backend){const {createBackend}=await import("./sync/backend.js");backend=await createBackend();backend.onChange(onAuth)}
  return backend;
}

export async function initAccount(){
  addEventListener("online",()=>acct.status==="error"?retry():flush());
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refresh();else{saveSession();sendLogs()}});
  const hash=new URLSearchParams(location.hash.slice(1));
  // Sign-in is by code only (v1.3.0). A link that arrives with a sign-in or an error in the address is never
  // accepted: an old email's link, or one made to sign this device in to somebody else's account.
  if(hash.has("error_description")||hash.has("access_token")){
    history.replaceState(null,"",location.pathname+location.search);
    acct.error="That sign-in link has expired. The planner now signs in with a code: send yourself a new email and type the code from it.";
    acct.open=true;
  }
  // Signed in here before, but the sign-in is gone and nobody chose to sign out: say so (journey J7).
  const was=store.get(EMAIL), noSession=()=>{
    setLogging(false);if(was){markLost(was);render()}
    if(!acct.error)acct.sent=pendingEmail(); // the page reloaded while they read the email: keep the code box
    renderAccount();
  };
  if(!store.get(SESSION_KEY)&&!window.__plannerTestBackend)return noSession();
  try{
    const s=await (await getBackend()).session();
    if(s)await signedIn(s);else noSession();
  }catch(e){console.error(e);setLogging(false);renderAccount()}
}

function onAuth(event,session){
  if(event==="SIGNED_IN"&&session)signedIn(session);
  if(event==="SIGNED_OUT"&&acct.status!=="out"&&!leaving)lostSession();
}

// The sign-in ended without the family choosing it (Supabase ended the session). The plan stays on this
// device, and signing in again merges anything changed meanwhile, since signedOut() forgets the owner.
function lostSession(){
  const email=acct.email||store.get(EMAIL);
  if(email)markLost(email);
  signedOut();
  toast("You were signed out on this device. Your plan is still here. Sign in again to keep it in sync.");
}
function markLost(email){acct.lost=email;acct.lastEmail=email}

let lastSession=null;
async function signedIn(session){
  // A sign-in can report the same session twice (as it happens, then from storage); load once.
  if(session.user.id===acct.userId&&(acct.status==="loading"||acct.status==="in"))return;
  lastSession=session;
  acct.status="loading";acct.email=session.user.email||"";acct.userId=session.user.id;acct.error="";acct.sent="";acct.lost="";
  store.set(EMAIL,acct.email);setPending("");
  renderAccount();
  try{
    planId=await backend.openPlan(CYCLE);
    const remote=fromRows(await backend.load(planId)), local=st;
    // New to this device, or changed here while offline: combine. Otherwise the account has the latest plan.
    const firstHere=store.get(OWNER)!==session.user.id, combine=firstHere||store.get(UNSYNCED)==="1";
    synced=toRows(remote);
    replacePlan(combine?mergePlans(remote,local):remote);
    store.set(OWNER,session.user.id);
    await resumeSession();
    acct.status="in";
    setLogging(true,queueLogs);
    if(!opened){opened=true;track("app_open",{tab:ui.tab})}
    if(firstHere)track("sign_in",{method:"code",claimed_local:combine&&!isEmpty(local)});
    render();renderAccount();
    await flush();
    if(firstHere)toast(isEmpty(local)?"Signed in. Your plan is loaded.":isEmpty(remote)?"Signed in. Your plan is saved to your account.":"Signed in. We added this device's plan to your account.");
  }catch(e){
    reportError(e,"sign-in");acct.status="error";renderAccount();
    toast("Couldn't reach your account. Your plan is still saved on this device.");
  }
}
const retry=()=>lastSession&&signedIn(lastSession);

function signedOut(){
  setLogging(false);
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
    track("sync_failed",{error_code:String(e?.code||e?.status||"network").slice(0,40)});
    if(!warned){warned=true;toast("Couldn't save to your account. We'll keep trying. Your plan is safe on this device.")}
  });
  await busy;busy=null;
}

// Open where the family left off on their last device, unless they've already moved here (journey J3).
async function resumeSession(){
  try{const r=await backend.loadSession();if(r)applyRemoteSession({tab:r.last_tab,dbn:r.last_dbn,view:r.last_view,at:r.updated_at})}
  catch(e){console.error(e)} // not worth stopping sign-in for
}

// Called when the tab, school sheet or view changes (session.js). Saved a moment later, or when the page is hidden.
export function queueSessionSync(s){
  if(acct.status!=="in")return;
  sessionNext=s;clearTimeout(sessionTimer);sessionTimer=setTimeout(saveSession,1500);
}
async function saveSession(){
  clearTimeout(sessionTimer);
  const s=sessionNext;sessionNext=null;
  if(!s||acct.status!=="in")return;
  try{await backend.saveSession({user_id:acct.userId,last_tab:s.tab,last_dbn:s.dbn,last_view:s.view})}catch(e){console.error(e)}
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

export async function sendCode(email){
  acct.lastEmail=email;
  try{
    await (await getBackend()).sendCode(email);
    acct.sent=email;acct.error="";setPending(email);
  }catch(e){
    console.error(e);
    acct.error=/rate limit|too many/i.test(e.message||"")?"Too many sign-in emails were sent. Wait a few minutes, then try again."
      :/signups? not allowed|otp_disabled/i.test((e.message||"")+" "+(e.code||""))?"The planner is invite-only for now. Ask the person who shared it with you to invite this email address."
      :"Couldn't send the email. Check the address and your connection, then try again.";
  }
  renderAccount();
}

// Signing in is by a 6-digit code typed here, not a link (F-11 in docs/failure-modes.md): email apps that check links
// can't use it up, and it signs in the browser the family is using. Success arrives through onAuth (SIGNED_IN).
export async function signInWithCode(code){
  if(acct.codeBusy)return;
  if(!/^\d{6,10}$/.test(code)){acct.error="Type the code from the email: it's 6 digits.";renderAccount();return}
  acct.codeBusy=true;acct.error="";renderAccount();
  try{
    await (await getBackend()).verifyCode(acct.sent,code);
  }catch(e){
    console.error(e);
    acct.error=/rate limit|too many/i.test(e.message||"")?"Too many tries. Wait a few minutes, then try again."
      :"That code didn't work or has expired. Check it, or send yourself a new email.";
  }
  acct.codeBusy=false;renderAccount();
}

// Usage events and errors (log.js), sent in small batches while signed in.
function queueLogs(){clearTimeout(logTimer);logTimer=setTimeout(sendLogs,2000)}
async function sendLogs(){
  clearTimeout(logTimer);
  if(acct.status!=="in")return;
  const {events,errors}=takeLogs();
  if(!events.length&&!errors.length)return;
  try{await backend.log(events.map(e=>({user_id:acct.userId,name:e.name,props:e.props})),errors.map(e=>({user_id:acct.userId,...e})))}
  catch(e){console.error(e)} // dropped, not retried: these are only for us
}

// Sign out (J7): the account keeps the plan; the family chooses whether this device does too.
export async function signOut(keep){
  clearTimeout(timer);await flush();await saveSession();await sendLogs();
  leaving=true;
  try{await backend.signOut()}catch(e){console.error(e)}
  if(!keep)forgetDevice();
  store.set(EMAIL,"");signedOut();leaving=false;acct.open=false;acct.ask="";renderAccount();
  toast(keep?"Signed out. Your plan is still on this device.":"Signed out. Your plan was removed from this device.");
}
function forgetDevice(){replacePlan(null);forgetSession();store.set(UNSYNCED,"")}

// Download my data (J7): everything the account holds about this person's plan, as JSON.
export async function exportData(){
  try{
    const [rows,place]=await Promise.all([backend.load(planId),backend.loadSession()]);
    const strip=({plan_id,household_id,...r})=>r; // internal IDs mean nothing outside the app
    const data={exported_at:new Date().toISOString(),account:{email:acct.email},cycle:CYCLE,plan:strip(rows.plan),
      ...Object.fromEntries(Object.keys(CHILD_KEYS).map(t=>[t,rows[t].map(strip)])),last_place:place||null};
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
    a.download="middle-school-plan-"+data.exported_at.slice(0,10)+".json";
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    toast("Downloaded your data");
  }catch(e){reportError(e,"export");toast("Couldn't download your data. Check your connection and try again.")}
}

// Delete my account (J7). The server does it in one transaction, so either all of it happens or none of it.
export async function deleteAccount(removeLocal){
  acct.deleting=true;acct.error="";renderAccount();
  clearTimeout(timer);clearTimeout(sessionTimer);
  try{await backend.deleteAccount()}
  catch(e){
    reportError(e,"delete-account");acct.deleting=false;
    acct.error="Couldn't delete your account, so nothing was deleted. Check your connection and try again.";
    return renderAccount();
  }
  setLogging(false);leaving=true;
  try{await backend.signOut()}catch(e){console.error(e)}
  if(removeLocal)forgetDevice();
  store.set(EMAIL,"");signedOut();leaving=false;acct.open=false;acct.ask="";acct.deleting=false;renderAccount();
  toast(removeLocal?"Your account is deleted, and your plan was removed from this device.":"Your account is deleted. Your plan is still on this device.");
}

/* ---------------- ACCOUNT UI ---------------- */
const SAVING={saving:"Saving…",saved:"✓ All changes saved to your account",failed:"Couldn't save. We'll try again when you're back online."};
function setSaving(s){acct.saving=s;if(acct.open)renderAccount()}

function sheetBody(){
  if(acct.status==="in"&&acct.ask==="signout")return `<h2>Sign out on this device</h2>
    <p style="margin:0">Keep a copy of your plan on this device? Choose <b>Remove</b> on a shared or borrowed computer. Your account keeps your plan either way.</p>
    <div class="row"><button class="btn primary" data-acct="signout-keep">Keep a copy and sign out</button><button class="btn" data-acct="signout-remove">Remove it and sign out</button></div>
    <div><button class="linkbtn" data-acct="cancel">Cancel</button></div>`;
  if(acct.status==="in"&&acct.ask==="delete")return `<h2>Delete your account</h2>
    <p style="margin:0">This permanently deletes your account and the plan saved in it: your schools, visits, steps and notes. It can't be undone. If someone else shares your plan, it stays for them.</p>
    <p class="small muted" style="margin:0">Want a copy first? <button class="linkbtn" data-acct="export">Download my data</button></p>
    ${acct.error?`<div class="notice" role="alert"><div>${esc(acct.error)} Still stuck? ${feedbackButton("Tell us")}</div></div>`:""}
    <label for="acct-delete" class="lab">Type DELETE to confirm</label>
    <input id="acct-delete" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="10">
    <label class="row small" style="gap:8px;flex-wrap:nowrap"><input type="checkbox" id="acct-delete-local" checked> Also remove my plan from this device</label>
    <div class="row"><button class="btn danger" data-acct="delete-now" disabled>${acct.deleting?"Deleting…":"Delete my account"}</button><button class="linkbtn" data-acct="cancel">Cancel</button></div>`;
  if(acct.status==="in")return `<h2>Your account</h2>
    <p style="margin:0">Signed in as <b>${esc(acct.email)}</b>. Your plan is saved to your account and stays the same on every device where you sign in.</p>
    <p class="small" role="status" style="margin:0;color:var(--${acct.saving==="failed"?"bad":acct.saving==="saved"?"good":"muted"})">${SAVING[acct.saving]}</p>
    <div class="row"><button class="btn" data-acct="export">Download my data</button><button class="btn" data-acct="signout">Sign out on this device</button></div>
    <div><button class="linkbtn" data-acct="delete">Delete my account…</button></div>`;
  if(acct.status==="loading")return `<h2>Signing in…</h2><p class="muted" style="margin:0">Loading your plan.</p>`;
  if(acct.sent)return `<h2>Check your email</h2>
    <p style="margin:0">We sent a 6-digit code to <b>${esc(acct.sent)}</b>. Type it here. It works once, within 30 minutes.</p>
    ${acct.error?`<div class="notice" role="alert"><div>${esc(acct.error)} Still stuck? ${feedbackButton("Tell us")}</div></div>`:""}
    <form class="stack" style="gap:8px" data-acct-code="1">
      <label for="acct-code" class="lab">Code</label>
      <input id="acct-code" type="text" inputmode="numeric" autocomplete="one-time-code" required maxlength="12">
      <button class="btn primary" type="submit"${acct.codeBusy?' disabled aria-busy="true"':""}>${acct.codeBusy?"Signing in…":"Sign in"}</button>
    </form>
    <p class="muted small" style="margin:0">No email? Check your spam folder, or <button class="linkbtn" data-acct="again">send it again</button>.</p>`;
  return `${acct.lost?`<h2>Sign in again</h2>
    <p style="margin:0">You were signed out on this device. Your plan is still here; sign in to keep it in sync with your account.</p>`
    :`<h2>Keep your plan on all your devices</h2>
    <p style="margin:0">Sign in to save your schools, visits and notes to your account. We'll email you a 6-digit code. There's no password.</p>`}
    ${acct.status==="error"?`<div class="notice" role="alert"><div>Couldn't reach your account. Your plan is still saved on this device. <button class="linkbtn" data-acct="retry">Try again</button></div></div>`:""}
    ${acct.error?`<div class="notice" role="alert"><div>${esc(acct.error)} Still stuck? ${feedbackButton("Tell us")}</div></div>`:""}
    <form class="stack" style="gap:8px" data-acct-form="1">
      <label for="acct-email" class="lab">Email</label>
      <input id="acct-email" type="email" autocomplete="email" required maxlength="254" value="${esc(acct.lastEmail)}" placeholder="you@example.com">
      <button class="btn primary" type="submit">Email me a code</button>
    </form>
    ${acct.lost?`<p class="muted small" style="margin:0">Not ${esc(acct.lost)}? <button class="linkbtn" data-acct="forget">Forget this email</button></p>`:""}
    <p class="muted small" style="margin:0">Signing in is optional. Your plan always stays on this device too. By signing in you agree to the <a href="privacy.html" target="_blank">privacy notice and terms</a>.${PILOT?" This planner is a pilot, so things may change.":""}</p>`;
}

export function renderAccount(){
  const b=$("#acct");
  if(b)b.innerHTML=acct.status==="in"
    ?`<button class="btn acct-btn" data-acct="open" aria-label="Account: ${esc(acct.email)}"><span class="acct-dot" aria-hidden="true">${esc((acct.email[0]||"?").toUpperCase())}</span><span class="acct-label">Account</span></button>`
    :`<button class="btn acct-btn" data-acct="open"${acct.status==="loading"?' aria-busy="true"':""}><svg class="acct-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg><span class="acct-label">${acct.status==="loading"?"Signing in…":"Sign in"}</span></button>`;
  const s=$("#acctsheet");
  if(!s)return;
  // keep what's being typed across re-renders
  const typed=document.getElementById("acct-email")?.value, code=document.getElementById("acct-code")?.value, del=document.getElementById("acct-delete")?.value, local=document.getElementById("acct-delete-local")?.checked;
  s.innerHTML=acct.open?`<div class="sheet" data-acct="close"><div class="sheet-in acct-sheet" role="dialog" aria-modal="true" aria-label="Account">
    <div class="sheet-bar"><button class="btn" data-acct="close">← Back</button></div><div class="stack">${sheetBody()}</div></div></div>`:"";
  const input=document.getElementById("acct-email");
  if(input&&typed!=null)input.value=typed;
  const ci=document.getElementById("acct-code");
  if(ci&&code!=null)ci.value=code;
  const d=document.getElementById("acct-delete");
  if(d&&del!=null){d.value=del;document.getElementById("acct-delete-local").checked=local}
  canDelete();
}
function canDelete(){
  const b=document.querySelector('[data-acct="delete-now"]');
  if(b)b.disabled=acct.deleting||document.getElementById("acct-delete").value.trim().toUpperCase()!=="DELETE";
}

document.addEventListener("click",e=>{
  const t=e.target.closest("[data-acct]");
  if(!t)return;
  const a=t.dataset.acct;
  if(a==="close"&&e.target!==t&&!e.target.closest("button[data-acct]"))return; // clicks inside the sheet
  if(a==="open"){acct.open=true;renderAccount();document.getElementById("acct-email")?.focus()}
  if(a==="close"){acct.open=false;acct.ask="";acct.error="";renderAccount()}
  if(a==="again"){acct.sent="";acct.error="";setPending("");renderAccount();document.getElementById("acct-email")?.focus()}
  if(a==="retry")retry();
  if(a==="forget"){ // a shared computer
    store.set(EMAIL,"");acct.lost="";acct.lastEmail="";
    const i=document.getElementById("acct-email");if(i)i.value=""; // renderAccount keeps what's in the box
    renderAccount();render();
  }
  if(a==="signout"||a==="delete"){acct.ask=a;acct.error="";renderAccount();document.getElementById("acct-delete")?.focus()}
  if(a==="cancel"){acct.ask="";acct.error="";renderAccount()}
  if(a==="signout-keep"||a==="signout-remove")signOut(a==="signout-keep");
  if(a==="export")exportData();
  if(a==="delete-now"&&!t.disabled)deleteAccount(document.getElementById("acct-delete-local").checked);
});
document.addEventListener("submit",e=>{
  if(e.target.dataset.acctCode){
    e.preventDefault();
    signInWithCode(document.getElementById("acct-code").value.replace(/\D/g,""));
    return;
  }
  if(!e.target.dataset.acctForm)return;
  e.preventDefault();
  const email=document.getElementById("acct-email").value.trim();
  if(email)sendCode(email);
});
document.addEventListener("input",e=>{if(e.target.id==="acct-delete")canDelete()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&acct.open){acct.open=false;acct.ask="";acct.error="";renderAccount()}});
