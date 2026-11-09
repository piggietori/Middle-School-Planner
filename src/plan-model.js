/* The family's plan as one object (what the views use), and as database rows (what the account stores).
   Pure functions only: no storage, no network. See supabase/migrations for the tables. */

export const DEFAULT = {home:"",maxMiles:1.5,needSubway:false,skipCompetitive:false,
  w:{distance:2,scores:1,safety:2,bullying:1,teachers:1},programs:[],saved:[],going:[],attended:[],done:{},notes:{}};

// Fill in anything missing, so plans saved by older versions still work.
export const normalize = v => v ? {...structuredClone(DEFAULT),...v,w:{...DEFAULT.w,...(v.w||{})}} : structuredClone(DEFAULT);

// Nothing the family chose yet: settings at their defaults and no saved schools, visits, steps or notes.
export function isEmpty(p){
  return !p.saved.length&&!p.going.length&&!p.attended.length&&!Object.values(p.done).some(Boolean)&&!Object.keys(p.notes).length
    &&p.home===DEFAULT.home&&p.maxMiles===DEFAULT.maxMiles&&p.needSubway===DEFAULT.needSubway&&p.skipCompetitive===DEFAULT.skipCompetitive
    &&!p.programs.length&&Object.keys(DEFAULT.w).every(k=>p.w[k]===DEFAULT.w[k]);
}

const EPOCH="1970-01-01T00:00:00.000Z"; // notes from before notes had a date count as the oldest

// Tables with one row per thing, and the column that identifies the thing.
export const CHILD_KEYS = {saved_schools:"dbn",visits:"event_id",step_progress:"step_id",school_notes:"dbn"};

export function toRows(p){
  const visitIds=[...new Set([...p.going,...p.attended])];
  return {
    plan:{home:p.home,max_miles:p.maxMiles,need_subway:p.needSubway,skip_competitive:p.skipCompetitive,weights:p.w,programs:p.programs},
    saved_schools:p.saved.map((dbn,i)=>({dbn,rank:i+1})),
    visits:visitIds.map(event_id=>({event_id,going:p.going.includes(event_id),attended:p.attended.includes(event_id)})),
    step_progress:Object.keys(p.done).filter(k=>p.done[k]).map(step_id=>({step_id})),
    school_notes:Object.entries(p.notes).map(([dbn,n])=>({dbn,rating:n.rating,pros:n.pros,cons:n.cons,updated_at:n.updated||EPOCH})),
  };
}

export function fromRows(r){
  const pl=r.plan||{};
  const p=normalize({
    home:pl.home??DEFAULT.home, maxMiles:pl.max_miles!=null?Number(pl.max_miles):DEFAULT.maxMiles,
    needSubway:pl.need_subway??DEFAULT.needSubway, skipCompetitive:pl.skip_competitive??DEFAULT.skipCompetitive,
    w:pl.weights||DEFAULT.w, programs:pl.programs||[],
  });
  p.saved=[...(r.saved_schools||[])].sort((a,b)=>a.rank-b.rank).map(x=>x.dbn);
  p.going=(r.visits||[]).filter(v=>v.going).map(v=>v.event_id);
  p.attended=(r.visits||[]).filter(v=>v.attended).map(v=>v.event_id);
  p.done=Object.fromEntries((r.step_progress||[]).map(s=>[s.step_id,true]));
  p.notes=Object.fromEntries((r.school_notes||[]).map(n=>[n.dbn,{rating:n.rating,pros:n.pros,cons:n.cons,...(n.updated_at?{updated:new Date(n.updated_at).toISOString()}:{})}]));
  return p;
}

const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

// What to send so the account matches `next`, given it currently matches `prev`.
export function diffRows(prev,next){
  const d={plan:same(prev.plan,next.plan)?null:next.plan,upsert:{},remove:{}};
  for(const [t,key] of Object.entries(CHILD_KEYS)){
    const old=new Map(prev[t].map(r=>[r[key],r]));
    const now=new Set(next[t].map(r=>r[key]));
    const up=next[t].filter(r=>!same(old.get(r[key]),r));
    const rm=[...old.keys()].filter(k=>!now.has(k));
    if(up.length)d.upsert[t]=up;
    if(rm.length)d.remove[t]=rm;
  }
  return d;
}
export const isNoop=d=>!d.plan&&!Object.keys(d.upsert).length&&!Object.keys(d.remove).length;

/* Combine the plan on this device with the plan in the account (journey J2 in docs/journeys.md):
   saved schools keep the account's order, then add new ones from this device; visits and finished steps
   are combined; for each school the newer note wins; settings come from the account unless it never set them. */
export function mergePlans(account,local){
  if(isEmpty(account))return structuredClone(local);
  if(isEmpty(local))return structuredClone(account);
  const m=structuredClone(account);
  for(const k of ["home","maxMiles","needSubway","skipCompetitive"])if(same(account[k],DEFAULT[k]))m[k]=local[k];
  if(same(account.w,DEFAULT.w))m.w={...local.w};
  if(!account.programs.length)m.programs=[...local.programs];
  m.saved=[...account.saved,...local.saved.filter(d=>!account.saved.includes(d))];
  m.going=[...new Set([...account.going,...local.going])];
  m.attended=[...new Set([...account.attended,...local.attended])];
  m.done={...Object.fromEntries(Object.entries(local.done).filter(([,v])=>v)),...Object.fromEntries(Object.entries(account.done).filter(([,v])=>v))};
  for(const [dbn,n] of Object.entries(local.notes)){
    const a=account.notes[dbn];
    if(!a||(n.updated||"")>(a.updated||""))m.notes[dbn]=structuredClone(n);
  }
  return m;
}
