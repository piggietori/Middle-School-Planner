/* Where the family left off: the tab, the school sheet that was open, and that tab's view (journey J3).
   Kept on this device, and in the account when signed in, so the next visit on any device opens there. */
import {queueSessionSync} from "./account.js";
import {BY} from "./data.js";
import {ui} from "./ui.js";

const KEY="d20session", TABS=["home","dates","find","list"], VIEWS={dates:["cal","list"],list:["order","compare"]};
let last=null, touched=false, fromAddress=false;

const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))}catch(e){return null}};
const write=s=>{try{localStorage.setItem(KEY,JSON.stringify(s))}catch(e){}};
const current=()=>({tab:ui.tab,dbn:ui.openDbn||null,view:VIEWS[ui.tab]?(ui.tab==="dates"?ui.dateView:ui.listView):null});

function apply(s){
  if(!TABS.includes(s.tab))return;
  ui.tab=s.tab;
  if(VIEWS[s.tab]?.includes(s.view))s.tab==="dates"?ui.dateView=s.view:ui.listView=s.view;
  ui.openDbn=s.dbn&&BY[s.dbn]?s.dbn:null; // a school no longer listed just isn't reopened
}

// On load, before the first render. A link to another tab (#dates) wins; otherwise open where this device left off.
export function restoreSession(){
  const tab=location.hash.slice(1);
  fromAddress=TABS.includes(tab);
  const s=read();
  if(s&&(!fromAddress||s.tab===tab))apply(s);
  last=JSON.stringify(current());
}

// After every render: remember where we are, if it changed.
export function noteSession(){
  const s=current(), k=JSON.stringify(s);
  if(k===last)return;
  last=k;touched=true;
  write({...s,at:new Date().toISOString()});
  queueSessionSync(s);
}

// From the account, after signing in: use it if it's newer than this device's and the family hasn't
// moved since the page opened. Returns whether it changed the screen.
export function applyRemoteSession(s){
  if(!s||touched||(fromAddress&&s.tab!==ui.tab))return false;
  const mine=read();
  if(mine?.at&&Date.parse(mine.at)>=Date.parse(s.at))return false;
  apply(s);
  last=JSON.stringify(current());
  write({...current(),at:s.at});
  try{history.replaceState(null,"","#"+ui.tab)}catch(e){}
  return true;
}
