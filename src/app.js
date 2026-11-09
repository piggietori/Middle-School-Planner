import {initAccount} from "./account.js";
import {STEPS} from "./data.js";
import {toggleSave, toggleGoing, toggleWent, setNote, stepDone} from "./plan.js";
import {render, go} from "./render.js";
import {st, persist} from "./state.js";
import {ui} from "./ui.js";
import {CAL_RANGE} from "./views/dates.js";
import {msText, copyText} from "./views/list.js";
import {renderNotes, addNote, commitDrafts, openNotes, closeSheet} from "./views/notes.js";
import {renderSheet} from "./views/sheet.js";

/* ---------------- EVENTS ---------------- */
document.addEventListener("click",e=>{
  const t=e.target.closest("[data-tab],[data-tab-go],[data-open],[data-close],[data-save],[data-going],[data-step],[data-df],[data-w],[data-prog],[data-mv],[data-went],[data-dv],[data-cm],[data-day],[data-ostep],[data-copy],[data-copyall],[data-star],[data-addnote],[data-delnote],[data-notes],[data-lv],[data-compare]");
  if(!t)return;
  const d=t.dataset;
  if(d.close&&e.target!==t&&!e.target.closest("button[data-close]"))return; // clicks inside the sheet
  if(d.tab)return go(d.tab);
  if(d.tabGo)return go(d.tabGo);
  if(d.open){ui.openDbn=d.open;renderSheet();return}
  if(d.close)return closeSheet();
  if(d.notes)return openNotes(d.notes);
  if(d.star){const [s,r]=d.star.split(":");setNote(s,n=>{n.rating=n.rating===+r?0:+r});return renderNotes(s)} // tap the same star again to clear
  if(d.addnote){const [s,k]=d.addnote.split(":");return addNote(s,k)}
  if(d.delnote){const [s,k,i]=d.delnote.split(":");setNote(s,n=>n[k].splice(+i,1));return renderNotes(s)}
  if(d.save)return toggleSave(d.save);
  if(d.going)return toggleGoing(d.going);
  if(d.went)return toggleWent(d.went);
  if(d.copy)return copyText(d.copy,"Copied "+d.copy+". Paste it into the MySchools search box.");
  if(d.copyall)return copyText(msText(),"Copied your list");
  if(d.dv){ui.dateView=d.dv;return render()}
  if(d.lv){ui.listView=d.lv;return render()}
  if(d.compare){commitDrafts();ui.listView="compare";return go("list")}
  if(d.cm){ui.calMonth=Math.max(0,Math.min(CAL_RANGE.length-1,ui.calMonth+(+d.cm)));ui.selDay=null;return render()}
  if(d.day){ui.selDay=d.day;return render()}
  if(d.step){st.done[d.step]=!st.done[d.step];ui.openStep=null;persist();return render()}
  if(d.ostep){const cur=STEPS.find(s=>!stepDone(s)),openId=ui.openStep??cur?.id;ui.openStep=openId===d.ostep?"":d.ostep;return render()}
  if(d.df){ui.dateFilter=d.df;return render()}
  if(d.w){const [k,v]=d.w.split(":");st.w[k]=+v;st.done.s1=true;persist();return render()}
  if(d.prog){const p=d.prog;st.programs=st.programs.includes(p)?st.programs.filter(x=>x!==p):[...st.programs,p];persist();return render()}
  if(d.mv){const [i,dir]=d.mv.split(":").map(Number),a=st.saved,j=i+dir;[a[i],a[j]]=[a[j],a[i]];persist();return render()}
});
document.addEventListener("change",e=>{
  const id=e.target.id;
  if(id==="home"){st.home=e.target.value;st.done.s1=!!st.home||st.done.s1}
  else if(id==="maxm")st.maxMiles=+e.target.value;
  else if(id==="subway")st.needSubway=e.target.checked;
  else if(id==="skipc")st.skipCompetitive=e.target.checked;
  else return;
  persist();render();
});
document.addEventListener("keydown",e=>{
  const ni=e.target.dataset&&e.target.dataset.noteinput;
  if(ni&&e.key==="Enter"){e.preventDefault();const [s,k]=ni.split(":");return addNote(s,k)}
  if(e.key==="Escape"&&ui.openDbn)closeSheet();
});
render();
initAccount();
