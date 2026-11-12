/* Usage events and errors (docs/journeys.md, "Events we log"). Kept small: IDs only, never names, notes or where a
   family lives. Signed in, account.js sends them with the person's ID. Signed out, they're sent here with no user:
   no cookie, and the visit ID below is made fresh on each page load and never saved, so visits can't be linked. */
import {ui} from "./ui.js";
import {SUPABASE_URL, SUPABASE_KEY} from "./config.js";

// Random per page load, in memory only.
export const VISIT=(()=>{try{return crypto.randomUUID()}catch(e){return null}})();

let on=null; // null: not known yet (still signing in), true: signed in, false: signed out
let events=[], errors=[], send=null, sent=0, timer=null;
const seen=new Set();
const MAX_SENT=300; // per visit; a long visit is about 100

// Signed-out visitors send only from the live site (and from tests that turn it on), so trying the planner on a
// laptop never adds to the reports.
function anonOn(){
  try{if(localStorage.getItem("d20-usage-test")==="1")return true}catch(e){}
  return location.hostname==="d20.torilam.com";
}

export function track(name,props={}){
  if(events.length>=50||sent>=MAX_SENT||(on===false&&!anonOn()))return;
  events.push({name,props});
  if(on&&send)send();else if(on===false)later();
}

export function reportError(e,where){
  console.error(e);
  if(on===false&&!anonOn())return;
  const message=String(e?.message||e||"Unknown error").slice(0,500);
  if(seen.has(where+message)||seen.size>=10)return; // the same error once, and at most 10 per visit
  seen.add(where+message);
  errors.push({message,stack:String(e?.stack||"").slice(0,4000)||null,
    context:`${where} · ${location.pathname} · ${ui.tab}`.slice(0,200),user_agent:navigator.userAgent.slice(0,300)});
  if(on&&send)send();else if(on===false)later();
}

let opened=false;
export function setLogging(signedIn,sender){
  on=signedIn;send=sender||null;
  if(!opened){opened=true;track("app_open",{tab:ui.tab,signed_in:!!signedIn})} // once a visit, when we know whether they are signed in
  if(on&&send&&(events.length||errors.length))send();
  else if(on===false){if(anonOn())later();else{events=[];errors=[]}}
}

export function takeLogs(){const out={events,errors};sent+=events.length;events=[];errors=[];return out}

// Signed out: send in batches a few seconds apart, and whatever is left when the page is hidden or closed.
function later(){if(!timer)timer=setTimeout(sendAnon,5000)}
function sendAnon(){
  clearTimeout(timer);timer=null;
  if(on!==false)return;
  if(!anonOn()){events=[];errors=[];return}
  const {events:ev,errors:er}=takeLogs();
  const post=(table,rows)=>rows.length&&fetch(`${SUPABASE_URL}/rest/v1/${table}`,{method:"POST",keepalive:true,
    headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify(rows)})
    .catch(()=>{}); // dropped, not retried: these are only for us
  post("events",ev.map(e=>({name:e.name,props:e.props,visit:VISIT})));
  post("client_errors",er);
}
addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&on===false)sendAnon()});
