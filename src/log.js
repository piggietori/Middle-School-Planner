/* Usage events and errors (docs/journeys.md, "Events we log"). Sent only while signed in (account.js sends
   them); signed-out visitors send nothing. Kept small: IDs only, never names, notes or where a family lives. */
import {ui} from "./ui.js";

let on=null; // null: not known yet (still signing in), true: signed in, false: signed out
let events=[], errors=[], send=null;
const seen=new Set();

export function track(name,props={}){
  if(on===false||events.length>=50)return;
  events.push({name,props});
  if(on&&send)send();
}

export function reportError(e,where){
  console.error(e);
  if(on===false)return;
  const message=String(e?.message||e||"Unknown error").slice(0,500);
  if(seen.has(where+message)||seen.size>=10)return; // the same error once, and at most 10 per visit
  seen.add(where+message);
  errors.push({message,stack:String(e?.stack||"").slice(0,4000)||null,
    context:`${where} · ${location.pathname} · ${ui.tab}`.slice(0,200),user_agent:navigator.userAgent.slice(0,300)});
  if(on&&send)send();
}

export function setLogging(signedIn,sender){
  on=signedIn;send=sender||null;
  if(!on){events=[];errors=[]}
  else if(send&&(events.length||errors.length))send();
}

export function takeLogs(){const out={events,errors};events=[];errors=[];return out}
