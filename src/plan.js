import {BY, OH, EVENTS} from "./data.js";
import {track} from "./log.js";
import {render} from "./render.js";
import {st, persist} from "./state.js";
import {toast} from "./util.js";
import {openNotes} from "./views/notes.js";

/* Changes to the plan, and progress worked out from it. */
export const isSaved=d=>st.saved.includes(d);
export function toggleSave(d){st.saved=isSaved(d)?st.saved.filter(x=>x!==d):[...st.saved,d];track(isSaved(d)?"school_saved":"school_removed",{dbn:d});if(st.saved.length)st.done.s2=true;persist();toast(isSaved(d)?"Saved to My list":"Removed from My list");render()}
export function toggleGoing(id){st.going=st.going.includes(id)?st.going.filter(x=>x!==id):[...st.going,id];persist();render()}
export function toggleWent(id){const on=!st.attended.includes(id);st.attended=on?[...st.attended,id]:st.attended.filter(x=>x!==id);
  if(on&&!st.going.includes(id))st.going=[...st.going,id];persist();
  if(on)track("visit_marked",{event_id:id});
  const ev=OH.find(e=>e.id===id);
  if(on&&ev){toast("Marked as visited. Add your notes while they're fresh.");render();openNotes(ev.dbn)} // jump straight to notes after a visit
  else{toast(on?"Marked as visited":"Visit unmarked");render()}}
// Each family's own rating and pros/cons per school, kept with the rest of their plan.
export const RATING_WORDS=["","Not for us","Has concerns","It's okay","Really like it","Love it"];
export const noteOf=d=>st.notes[d]||{rating:0,pros:[],cons:[]};
export const hasNotes=d=>!!st.notes[d];
export function setNote(d,fn){const n=JSON.parse(JSON.stringify(noteOf(d)));fn(n);n.updated=new Date().toISOString();
  if(!n.rating&&!n.pros.length&&!n.cons.length)delete st.notes[d];else st.notes[d]=n;persist()}
export const starText=r=>"★".repeat(r)+"☆".repeat(5-r);
// "Visit open houses" is done only once every open house you planned to attend is marked as visited.
export function visitProgress(){const planned=st.going.filter(id=>EVENTS.some(e=>e.id===id&&e.kind==="open"));
  return {planned:planned.length,went:planned.filter(id=>st.attended.includes(id)).length}}
// Saved schools that admit only by audition or only by screen (grades and attendance).
export const testSchools=()=>st.saved.map(d=>BY[d]).filter(s=>s&&(s.admit.includes("audition")||s.admit.every(a=>a==="screened")));
export const s5Skipped=()=>st.saved.length>0&&testSchools().length===0;
export function stepDone(s){if(s.id==="s3"){const p=visitProgress();return p.planned>0&&p.went===p.planned}
  if(s.id==="s5"&&s5Skipped())return true;
  return !!st.done[s.id]}
