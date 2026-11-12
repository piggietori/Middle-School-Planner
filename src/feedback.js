/* Send feedback: a short form. The message is saved in the feedback table and emailed to the owner
   (supabase/migrations/20261111130000_feedback.sql). It's sent without linking the account, signed in or not;
   the family chooses whether to leave a reply address. Nothing is sent until they press Send. */
import {acct} from "./account.js";
import {SUPABASE_KEY, SUPABASE_URL} from "./config.js";
import {track} from "./log.js";
import {ui} from "./ui.js";
import {$, esc, toast} from "./util.js";

const KINDS=[["problem","Something isn't working"],["wrong_info","A date or school detail is wrong"],["idea","An idea"],["other","Something else"]];
const fb={open:false,sending:false,error:"",kind:"problem",fresh:true};

export const feedbackButton=(label="Send feedback")=>`<button class="linkbtn" data-feedback="1">${label}</button>`;

export function openFeedback(){fb.open=true;fb.error="";fb.fresh=true;renderFeedback();$("#fb-message")?.focus()}
function closeFeedback(){fb.open=false;renderFeedback()}

function renderFeedback(){
  const s=$("#fbsheet");if(!s)return;
  // keep what's being typed across re-renders
  const msg=$("#fb-message")?.value, reply=$("#fb-reply")?.value;
  fb.kind=document.querySelector('input[name="fb-kind"]:checked')?.value||fb.kind;
  s.innerHTML=fb.open?`<div class="sheet" data-fb="close"><div class="sheet-in acct-sheet" role="dialog" aria-modal="true" aria-labelledby="fb-title">
    <div class="sheet-bar"><button class="btn" data-fb="close">← Back</button></div>
    <form class="stack" data-fb-form="1">
      <h2 id="fb-title">Send feedback</h2>
      <p style="margin:0">A problem, a wrong date, or an idea? It goes straight to the parent who runs the planner.</p>
      <fieldset class="stack fb-kinds"><legend class="lab">What is it about?</legend>
        ${KINDS.map(([k,l])=>`<label class="row"><input type="radio" name="fb-kind" value="${k}"${fb.kind===k?" checked":""}> ${l}</label>`).join("")}</fieldset>
      <label for="fb-message" class="lab">Your message</label>
      <textarea id="fb-message" required maxlength="2000" rows="5"></textarea>
      <label for="fb-reply" class="lab">Your email, if you'd like a reply (optional)</label>
      <input id="fb-reply" type="email" maxlength="254" autocomplete="email" placeholder="you@example.com">
      ${fb.error?`<div class="notice" role="alert"><div>${esc(fb.error)}</div></div>`:""}
      <button class="btn primary" type="submit"${fb.sending?" disabled":""}>${fb.sending?"Sending…":"Send"}</button>
      <p class="muted small" style="margin:0">Please don't include your child's name. Messages are kept for a year. <a href="privacy.html" target="_blank">Privacy</a></p>
    </form></div></div>`:"";
  if(!fb.open)return;
  $("#fb-message").value=msg??"";
  $("#fb-reply").value=fb.fresh?(acct.email||""):(reply??"");
  fb.fresh=false;
}

async function send(){
  const message=$("#fb-message").value.trim(), reply=$("#fb-reply").value.trim();
  if(!message)return $("#fb-message").focus();
  fb.kind=document.querySelector('input[name="fb-kind"]:checked')?.value||"other";
  fb.sending=true;fb.error="";renderFeedback();
  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/feedback`,{method:"POST",
      headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json",Prefer:"return=minimal"},
      body:JSON.stringify({kind:fb.kind,message,reply_to:reply||null,page:[ui.tab,ui.openDbn].filter(Boolean).join(" · ")})});
    if(!r.ok)throw new Error(`${r.status} ${(await r.text()).slice(0,200)}`);
    track("feedback_sent",{kind:fb.kind});
    fb.sending=false;$("#fb-message").value="";closeFeedback();
    toast("Thanks! Your feedback was sent.");
  }catch(e){
    console.error(e);fb.sending=false;
    fb.error=navigator.onLine===false?"You're offline. Your message is still here: send it when you're back online."
      :"Couldn't send it. Check the email address, or try again in a moment.";
    renderFeedback();
  }
}

document.addEventListener("click",e=>{
  const t=e.target.closest("[data-feedback],[data-fb]");
  if(!t)return;
  if(t.dataset.feedback)return openFeedback();
  if(t.dataset.fb==="close"&&(e.target===t||e.target.closest("button[data-fb]")))closeFeedback(); // not clicks inside the sheet
});
document.addEventListener("submit",e=>{if(e.target.dataset.fbForm){e.preventDefault();send()}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&fb.open)closeFeedback()});
