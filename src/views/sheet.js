import {CITY, PROG, BY, OH} from "../data.js";
import {homePt, match} from "../match.js";
import {isSaved} from "../plan.js";
import {st} from "../state.js";
import {ui} from "../ui.js";
import {$, esc, bullets, fmtDay} from "../util.js";
import {meter, evRow, sourceName} from "./common.js";
import {notesCard, commitDrafts} from "./notes.js";
import {noteSession} from "../session.js";

/* School detail sheet. */
// Where each part of the profile came from; one line when every part shares a source.
function sources(s){
  const one=p=>`${esc(sourceName(p.source))}${p.period?" ("+esc(p.period)+" school year)":""}, updated ${fmtDay(p.as_of)}.`;
  const parts=[["Test results",s.provenance.scores],["Survey",s.provenance.survey],["School details",s.provenance.profile]];
  return new Set(parts.map(([,p])=>one(p))).size===1?"Source: "+one(parts[0][1]):parts.map(([k,p])=>k+": "+one(p)).join(" ");
}
function stat(label,v,city,bad){
  if(v==null)return `<div class="stat"><div class="stat-row"><span>${label}</span><span class="muted">No data</span></div><div class="bar"></div></div>`;
  return `<div class="stat"><div class="stat-row"><span>${label}</span><b>${v}%</b></div>
    <div class="bar" role="img" aria-label="${v}% versus citywide ${city}%"><i class="${bad?"bad":""}" style="width:${v}%"></i><u style="left:${city}%"></u></div>
    <span class="muted small">Citywide: ${city}%${bad?" (lower is better)":""}</span></div>`;
}
function gmaps(s){const h=homePt(st),dest=encodeURIComponent(s.addr+", Brooklyn, NY");
  return h?`https://www.google.com/maps/dir/?api=1&origin=${h.lat},${h.lng}&destination=${dest}&travelmode=transit`:`https://www.google.com/maps/search/?api=1&query=${dest}`}
export function renderSheet(){
  const box=$("#sheet");
  commitDrafts(); // the sheet is about to be rebuilt; keep anything typed in the notes boxes
  noteSession();
  if(!ui.openDbn){box.innerHTML="";return}
  const s=BY[ui.openDbn],m=match(s,st),ev=OH.filter(e=>e.dbn===s.dbn);
  box.innerHTML=`<div class="sheet" data-close="1"><div class="sheet-in" role="dialog" aria-modal="true" aria-label="${esc(s.name)}">
    <div class="sheet-bar"><button class="btn" data-close="1">← Back</button><span style="margin-left:auto"></span><button class="btn${isSaved(s.dbn)?" saved":" primary"}" data-save="${s.dbn}">${isSaved(s.dbn)?"★ Saved":"☆ Save"}</button></div>
    <div class="stack">
      <div><div class="rank">${s.dbn}</div><h2 style="margin-top:4px">${esc(s.name)}</h2>
      <div class="meta" style="margin-top:6px"><span>${esc(s.addr)}</span>${m.dist!=null?`<span>${m.dist.toFixed(1)} mi from home</span>`:""}<span>Grades ${s.grades}</span><span>${s.size.toLocaleString()} students</span></div></div>
      <div class="card">${meter(m.score)}<p class="muted small" style="margin:.5rem 0 0">How well this school fits the answers you gave on Find schools.</p></div>
      <div class="card stack notes-card" id="notesbox">${notesCard(s.dbn)}</div>
      <div class="card stack"><h3>Where it is</h3>
        <div class="row"><a class="btn primary" href="${gmaps(s)}" target="_blank" rel="noopener">${homePt(st)?"Directions in Google Maps":"Open in Google Maps"}</a></div>
        <div class="muted small" id="mapnote">${esc(s.addr)}, Brooklyn${m.dist!=null?" · "+m.dist.toFixed(1)+" mi from home in a straight line":" · Pick your neighborhood on Find schools to see the distance"}</div></div>
      <div class="card stack"><h3>Getting there</h3>
        <div>${s.subway.length?bullets(s.subway):`<span class="muted">No subway nearby.</span>`}</div>
        <div><span class="muted small">Buses: </span>${s.bus.map(b=>`<span class="bus">${b}</span>`).join("")}</div></div>
      <div class="card stack"><h3>How to get in</h3><p style="margin:0">${esc(s.admitText)}</p>
        ${s.admit.includes("zoned")?`<p class="muted small" style="margin:0">Zoned programs give first priority to students who live in the school's zone. <a href="https://www.schools.nyc.gov/find-a-school" target="_blank" rel="noopener">Find your zoned school</a>.</p>`:""}</div>
      <div class="card stack"><h3>By the numbers</h3><div class="stats">
        ${stat("Math: students passing",s.math,CITY.math)}${stat("Reading: students passing",s.ela,CITY.ela)}
        ${stat("Students who feel safe",s.safe,CITY.safe)}${stat("Students who say bullying happens often",s.bully,CITY.bully,true)}
        ${stat("Teachers who recommend the school",s.teach,CITY.teach)}</div>
        <span class="muted small">Middle school grades. The dark line marks the citywide average.</span></div>
      <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
        <div class="card"><h3>Highlights</h3><ul class="why" style="margin-top:8px">${s.good.map(g=>`<li>${esc(g)}</li>`).join("")}</ul>
          <div class="chips" style="margin-top:12px">${s.tags.map(t=>`<span class="pill">${PROG[t]}</span>`).join("")}</div></div>
        <div class="card"><h3>Reported concerns</h3><ul class="why caution" style="margin-top:8px">${s.concerns.map(g=>`<li>${esc(g)}</li>`).join("")}</ul></div>
      </div>
      <div class="card"><h3>Open houses</h3>${ev.map(e=>evRow(e)).join("")}</div>
      <div class="row"><a class="btn" href="${s.web}" target="_blank" rel="noopener">School website</a><a class="btn" href="https://insideschools.org/school/${s.dbn}" target="_blank" rel="noopener">Full review on InsideSchools</a>${s.flyer?`<a class="btn" href="${s.flyer}" target="_blank" rel="noopener">Open house flyer</a>`:""}</div>
      <p class="muted small" style="margin:0">${sources(s)} Check with the school for the latest.</p>
    </div></div></div>`;
}
