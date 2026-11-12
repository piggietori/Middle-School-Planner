import {queueSync} from "./account.js";
import {normalize} from "./plan-model.js";

/* The family's plan. Always kept in this browser; when signed in, also saved to the account (see account.js). */
export let st = load();
function load(){try{return normalize(JSON.parse(localStorage.getItem("d20plan")||"null"))}catch(e){return normalize(null)}}
function keep(){try{localStorage.setItem("d20plan",JSON.stringify(st))}catch(e){}}
export function persist(){keep();queueSync()}
// Another tab of the planner changed the plan on this device: use its copy, so this tab's next change doesn't undo it.
export function reloadPlan(){st=load()}
// Swap in a plan that came from the account.
export function replacePlan(p){st=normalize(p);keep()}
