/* ---------------- DATA ---------------- */
// Source data lives in data/*.json (see the "sources" and "provenance" fields there). This module
// shapes it for the views. Distances are straight-line estimates.
// The files are fetched, not imported as JSON modules: phones a few years old (iPhones that stop at iOS 16, for
// example) can't import JSON, and for them the whole planner would fail to load (F-09 in docs/failure-modes.md).
async function read(name){
  const url=new URL(`../data/${name}.json`,import.meta.url);
  if(url.protocol==="file:")return JSON.parse((await import("node:fs")).readFileSync(url,"utf8")); // unit tests, in Node
  const res=await fetch(url);
  if(!res.ok)throw new Error(`${res.status} loading ${name}.json`);
  return res.json();
}
const [schoolsFile,eventsFile,neighborhoodsFile,stepsFile,noticeFile]=await Promise.all(["schools","events","neighborhoods","steps","notice"].map(read));

const {provenance, ...city} = schoolsFile.city_averages;
export const CITY = city;
export const PROG = schoolsFile.programs;
export const SOURCES = schoolsFile.sources;
export const CYCLE = schoolsFile.cycle;
export const S = schoolsFile.schools;
export const BY = Object.fromEntries(S.map(s=>[s.dbn,s]));
export const OH = eventsFile.events.filter(e=>e.kind==="open").map(e=>({...e,note:e.note||""})); // open houses, in flyer order
export const KEY = eventsFile.events.filter(e=>e.kind==="key");
export const EVENTS = [...OH,...KEY].sort((a,b)=>(a.date+(a.start||"")).localeCompare(b.date+(b.start||"")));
export const HOMES = neighborhoodsFile.neighborhoods;
export const NOTICE = noticeFile.notice; // the announcement banner, or null (notices.js)
export const keyDate = id=>KEY.find(e=>e.id===id).date;
// "December 11, 2026", or "Friday, December 11, 2026" with the weekday
export const longDate = (s,weekday)=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString("en-US",{weekday:weekday?"long":undefined,month:"long",day:"numeric",year:"numeric"})};
// Step text can name a key date as {k-close}; it's filled in from events.json.
export const STEPS = stepsFile.steps.map(s=>({...s,t:fillDates(s.t),d:fillDates(s.d)}));
function fillDates(t){return t.replace(/\{(k-[\w-]+)\}/g,(_,id)=>longDate(keyDate(id)))}
// The most recent date any record was checked against its source.
export const DATA_AS_OF = [...S.flatMap(s=>Object.values(s.provenance)),...eventsFile.events,...Object.values(schoolsFile.city_averages.provenance)]
  .map(p=>p.as_of).sort().at(-1);
