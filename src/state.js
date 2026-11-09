import {render} from "./render.js";

/* The family's plan: kept in this browser, and synced to the viewer's private store when the page runs as a Claude artifact. */
const DEFAULT = {home:"",maxMiles:1.5,needSubway:false,skipCompetitive:false,
  w:{distance:2,scores:1,safety:2,bullying:1,teachers:1},programs:[],saved:[],going:[],attended:[],done:{},notes:{}};
export let st = load();
function load(){try{const v=JSON.parse(localStorage.getItem("d20plan")||"null");if(v)return {...DEFAULT,...v,w:{...DEFAULT.w,...(v.w||{})}}}catch(e){}return structuredClone(DEFAULT)}
let dbRef=null, saveTimer=null;
export function persist(){
  try{localStorage.setItem("d20plan",JSON.stringify(st))}catch(e){}
  if(dbRef){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{dbRef.set(JSON.parse(JSON.stringify(st))).catch(()=>{})},700)}
}
(async()=>{ // keep the plan in the viewer's private store so it follows them across devices
  try{
    if(!window.claude?.use) return;
    const [db,user]=await Promise.all([claude.use("db"),claude.use("user")]);
    if(!db||!user) return;
    const id=await user.id(); if(!id) return;
    const ref=db.doc("data/users/"+id+"/plan");
    const snap=await ref.get();
    if(snap.exists){st={...DEFAULT,...snap.data(),w:{...DEFAULT.w,...(snap.data().w||{})}};try{localStorage.setItem("d20plan",JSON.stringify(st))}catch(e){};render()}
    dbRef=ref;
    if(!snap.exists) persist();
  }catch(e){}
})();
