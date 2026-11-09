import {BY} from "./data.js";

/* ---------------- HELPERS ---------------- */
export const $=s=>document.querySelector(s);
export const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
export const today=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
export const pd=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
export const daysUntil=s=>Math.round((pd(s)-today())/864e5);
export const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const DOW=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
export const fmtT=t=>{if(!t)return"";let [h,m]=t.split(":").map(Number);const ap=h>=12?"PM":"AM";h=h%12||12;return h+(m?":"+String(m).padStart(2,"0"):"")+" "+ap};
export const when=e=>{const d=pd(e.date);return DOW[d.getDay()]+", "+MON[d.getMonth()]+" "+d.getDate()+(e.start?" · "+fmtT(e.start)+(e.end?" – "+fmtT(e.end):""):"")};
export const fmtDay=s=>{const d=pd(s);return MON[d.getMonth()]+" "+d.getDate()+", "+d.getFullYear()};
export const rel=n=>n<0?"Passed":n===0?"Today":n===1?"Tomorrow":"In "+n+" days";
export function miles(a,b){const R=3958.8,t=x=>x*Math.PI/180;const dl=t(b.lat-a.lat),dg=t(b.lng-a.lng);
  const h=Math.sin(dl/2)**2+Math.cos(t(a.lat))*Math.cos(t(b.lat))*Math.sin(dg/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
export const evTitle=e=>e.kind==="key"?e.title:BY[e.dbn].name+" open house";
export function gcal(e){
  const s=e.start||"09:00";let en=e.end;
  if(!en){const [h,m]=s.split(":").map(Number);en=String(h+(e.start?1:0)).padStart(2,"0")+":"+String(m).padStart(2,"0")}
  const d=e.date.replace(/-/g,"");const dates=e.start?d+"T"+s.replace(":","")+"00/"+d+"T"+en.replace(":","")+"00":d+"/"+(n=>n.getFullYear()+String(n.getMonth()+1).padStart(2,"0")+String(n.getDate()).padStart(2,"0"))(new Date(pd(e.date).getTime()+864e5));
  const sc=e.dbn?BY[e.dbn]:null;
  const p=new URLSearchParams({action:"TEMPLATE",text:evTitle(e)+(e.note?" ("+e.note+")":""),dates,ctz:"America/New_York",
    details:(sc?"Middle school open house. School site: "+sc.web:e.text+" "+(e.link||"")),location:sc?(e.note==="Virtual"?"Online (see school website)":sc.addr+", Brooklyn, NY"):""});
  return "https://calendar.google.com/calendar/render?"+p.toString();
}
export function bullets(sub){return sub.map(x=>x.l.map(l=>`<span class="bul ${"BDF".includes(l)?"o":"y"}" aria-label="${l} train">${l}</span>`).join("")+" "+esc(x.st)).join(" &nbsp; ")}
export function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,2200)}
