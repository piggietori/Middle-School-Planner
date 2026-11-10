/* Messages for everyone: the pilot notice and the announcement banner (data/notice.json). See docs/launch.md. */
import {PILOT} from "./config.js";
import {NOTICE} from "./data.js";
import {feedbackButton} from "./feedback.js";
import {esc, daysUntil} from "./util.js";

const SEEN="d20pilot-ok"; // this device dismissed the pilot notice

// Until dismissed on this device: what a pilot is, and that MySchools is where the application really happens.
export function pilotNotice(){
  let seen=false;try{seen=localStorage.getItem(SEEN)==="1"}catch(e){}
  if(!PILOT||seen)return "";
  return `<div class="notice warn" role="note"><span aria-hidden="true">🧪</span><div><b>This planner is a pilot.</b> It's made by a District 20 parent, not by NYC Public Schools, and it may have mistakes. Confirm dates with each school, and remember that your application only counts when you submit it in MySchools. ${feedbackButton("Tell us about a problem")} · <button class="linkbtn" data-pilot-ok="1">Got it</button></div></div>`;
}
export function dismissPilot(){try{localStorage.setItem(SEEN,"1")}catch(e){}}

// The announcement banner, on every tab, until its "until" date has passed.
export function banner(){
  const n=NOTICE;
  if(!n||(n.until&&daysUntil(n.until)<0))return "";
  return `<div class="notice banner${n.level==="warn"?" warn":""}" role="status"><span aria-hidden="true">📣</span><div>${esc(n.text)}${n.link?` <a href="${esc(n.link.url)}" target="_blank" rel="noopener">${esc(n.link.label)}</a>`:""}</div></div>`;
}
