import {PROG, HOMES} from "../data.js";
import {ranked} from "../match.js";
import {isSaved} from "../plan.js";
import {st} from "../state.js";
import {esc, bullets} from "../util.js";
import {meter, noteSummary} from "./common.js";

/* Find schools: the family's answers and the ranked list. */
function seg(key,label,help){
  return `<div class="q"><span class="lab" id="lab-${key}">${label}</span>${help?`<span class="muted small">${help}</span>`:""}
  <div class="seg" role="group" aria-labelledby="lab-${key}">${["Not important","Important","Very important"].map((t,i)=>`<button aria-pressed="${st.w[key]===i}" data-w="${key}:${i}">${t}</button>`).join("")}</div></div>`;
}
function schoolCard(m,i){
  const s=m.s;
  return `<article class="sc">
    <div><div class="rank">#${i+1} for your family</div>
      <h3 style="margin-top:2px">${esc(s.name)}</h3>
      <div class="meta"><span>${esc(s.hood)}</span>${m.dist!=null?`<span>${m.dist.toFixed(1)} mi</span>`:""}<span>Grades ${s.grades}</span><span>${s.size.toLocaleString()} students</span></div></div>
    ${meter(m.score)}
    ${m.why.length?`<ul class="why">${m.why.map(w=>`<li>${esc(w)}</li>`).join("")}</ul>`:""}
    ${m.warn.length?`<ul class="why caution">${m.warn.map(w=>`<li>${esc(w)}</li>`).join("")}</ul>`:""}
    <div class="meta">${s.subway.length?bullets(s.subway):"Bus only: "+s.bus.slice(0,4).join(", ")}</div>
    ${noteSummary(s.dbn)}
    <div class="row"><button class="btn${isSaved(s.dbn)?" saved":" primary"}" data-save="${s.dbn}">${isSaved(s.dbn)?"★ Saved":"☆ Save"}</button><button class="btn" data-open="${s.dbn}">See details</button></div>
  </article>`;
}
export function vFind(){
  const r=ranked(st);
  const progs=Object.entries(PROG).map(([k,l])=>`<button class="chip" aria-pressed="${st.programs.includes(k)}" data-prog="${k}">${l}</button>`).join("");
  return `<section class="view">
    <div><h2>Find the right schools</h2><p class="muted" style="margin:.3rem 0 0">Answer a few questions. The list on the right updates as you go.</p></div>
    <div class="grid2">
      <div class="card" style="align-self:start">
        <div class="q"><label for="home">Where do you live?</label>
          <select id="home"><option value="">Choose your neighborhood</option>${HOMES.map(h=>`<option value="${h[0]}"${st.home===h[0]?" selected":""}>${h[1]}</option>`).join("")}</select>
          <span class="muted small">Pick the closest one. Distances are straight-line estimates.</span></div>
        <div class="q"><label for="maxm">How far can your child travel?</label>
          <select id="maxm">${[[.75,"Up to ¾ mile (walking)"],[1,"Up to 1 mile"],[1.5,"Up to 1½ miles"],[2,"Up to 2 miles"],[3,"Up to 3 miles (bus or train)"]].map(([v,l])=>`<option value="${v}"${st.maxMiles==v?" selected":""}>${l}</option>`).join("")}</select></div>
        <div class="q"><label class="toggle"><input type="checkbox" id="subway"${st.needSubway?" checked":""}>Must be near a subway</label>
          <label class="toggle"><input type="checkbox" id="skipc"${st.skipCompetitive?" checked":""}>Hide schools that admit only by audition or grades</label></div>
        ${seg("distance","Close to home")}
        ${seg("scores","Test scores","State math and reading results")}
        ${seg("safety","Feels safe","Students who say they feel safe")}
        ${seg("bullying","Less bullying","Students reporting bullying")}
        ${seg("teachers","Happy teachers","Teachers who would recommend the school")}
        <div class="q"><span class="lab">Programs your child wants</span><div class="chips">${progs}</div></div>
      </div>
      <div class="stack" style="min-width:0">
        <div class="row"><h2 style="margin-right:auto">Best matches</h2><span class="muted small">${r.length} schools</span></div>
        <details class="card small" style="padding:10px 16px"><summary>How is the match worked out?</summary>
          <p style="margin:.4rem 0">Each school gets a match from 0 to 100 based on your answers on this page. Things you mark <b>Very important</b> count twice as much as <b>Important</b>. Things marked <b>Not important</b> don't count.</p>
          <p style="margin:.4rem 0">Programs you pick add points when a school offers them. A school loses points if it is farther than you want to travel, or has no subway when you need one.</p>
          <p style="margin:.4rem 0"><b>Great match</b> is 78 or higher, <b>Good match</b> 62 or higher, <b>Possible</b> 48 or higher. It is a guide to help you choose which schools to visit, not an official rating.</p></details>
        ${st.home?"":`<div class="notice"><span aria-hidden="true">📍</span><div>Choose your neighborhood to include distance in the ranking.</div></div>`}
        ${r.map(schoolCard).join("")}
      </div>
    </div>
  </section>`;
}
