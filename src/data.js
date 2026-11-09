/* ---------------- DATA ---------------- */
// Source data lives in data/*.json (see the "sources" and "provenance" fields there). This module
// shapes it for the views. Distances are straight-line estimates.
import schoolsFile from "../data/schools.json" with {type: "json"};
import eventsFile from "../data/events.json" with {type: "json"};
import neighborhoodsFile from "../data/neighborhoods.json" with {type: "json"};
import stepsFile from "../data/steps.json" with {type: "json"};

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
export const STEPS = stepsFile.steps;
// The most recent date any record was checked against its source.
export const DATA_AS_OF = [...S.flatMap(s=>Object.values(s.provenance)),...eventsFile.events,...Object.values(schoolsFile.city_averages.provenance)]
  .map(p=>p.as_of).sort().at(-1);
