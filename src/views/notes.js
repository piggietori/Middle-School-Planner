import {RATING_WORDS, noteOf, setNote} from "../plan.js";
import {render} from "../render.js";
import {ui} from "../ui.js";
import {esc, MON} from "../util.js";
import {renderSheet} from "./sheet.js";

/* ---------------- OUR NOTES ---------------- */
function noteList(d,kind,title,ph,items){
  return `<div class="notelist ${kind}"><div class="lab">${title}</div>
    ${items.length?`<ul>${items.map((t,i)=>`<li><span>${esc(t)}</span><button class="x" data-delnote="${d}:${kind}:${i}" aria-label="Remove ${esc(t)}">×</button></li>`).join("")}</ul>`:""}
    <div class="addrow"><input id="${kind}-input" type="text" maxlength="200" placeholder="${ph}" aria-label="Add to ${title}" data-noteinput="${d}:${kind}" enterkeyhint="done"><button class="btn" data-addnote="${d}:${kind}">Add</button></div></div>`}
export function notesCard(d){const n=noteOf(d), up=n.updated?new Date(n.updated):null;
  return `<h3>Our notes</h3>
    <p class="muted small" style="margin:0">Write down what you noticed at the open house. Only you can see these.</p>
    <div class="stack" style="gap:6px"><div class="lab" id="rate-lab">Our rating</div>
      <div class="stars" role="radiogroup" aria-labelledby="rate-lab">${[1,2,3,4,5].map(i=>`<button class="star${i<=n.rating?" on":""}" role="radio" aria-checked="${n.rating===i}" aria-label="${i} star${i>1?"s":""}: ${RATING_WORDS[i]}" data-star="${d}:${i}">★</button>`).join("")}
      <span class="small ${n.rating?"":"muted"}" style="font-weight:700">${n.rating?RATING_WORDS[n.rating]:"Tap a star to rate"}</span></div></div>
    ${noteList(d,"pros","What we like","For example: friendly teachers, great science lab",n.pros)}
    ${noteList(d,"cons","What could be better","For example: long commute, crowded hallways",n.cons)}
    <div class="row" style="justify-content:space-between"><span class="muted small">Saved automatically${up?" · Last changed "+MON[up.getMonth()]+" "+up.getDate():""}</span>
      <button class="linkbtn small" data-compare="1">Compare with other schools</button></div>`}
export function renderNotes(d){const box=document.getElementById("notesbox");if(!box)return;
  const drafts={};["pros","cons"].forEach(k=>{const el=document.getElementById(k+"-input");if(el)drafts[k]=el.value}); // keep unsaved typing
  box.innerHTML=notesCard(d);["pros","cons"].forEach(k=>{const el=document.getElementById(k+"-input");if(el&&drafts[k])el.value=drafts[k]})}
export function addNote(d,kind){const el=document.getElementById(kind+"-input");if(!el)return;const v=el.value.trim();
  if(!v){el.focus();return}el.value="";setNote(d,n=>n[kind].push(v));renderNotes(d);document.getElementById(kind+"-input")?.focus()}
export function commitDrafts(){["pros","cons"].forEach(k=>{const el=document.getElementById(k+"-input");
  if(el&&el.value.trim()){const d=el.dataset.noteinput.split(":")[0],v=el.value.trim();el.value="";setNote(d,n=>n[k].push(v))}})}
export function openNotes(d){ui.openDbn=d;renderSheet();const b=document.getElementById("notesbox");if(b&&b.scrollIntoView)b.scrollIntoView({block:"start"})}
export function closeSheet(){commitDrafts();ui.openDbn=null;render()}
