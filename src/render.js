import {CYCLE} from "./data.js";
import {reportError} from "./log.js";
import {ui} from "./ui.js";
import {$} from "./util.js";
import {dataFooter} from "./views/common.js";
import {vDates} from "./views/dates.js";
import {vFind} from "./views/find.js";
import {vHome} from "./views/home.js";
import {vList} from "./views/list.js";
import {renderSheet} from "./views/sheet.js";

/* ---------------- VIEWS ---------------- */
export function render(){
  $("#cycle").textContent="Fall "+CYCLE+" admission";
  document.querySelectorAll(".tab").forEach(b=>b.setAttribute("aria-current",b.dataset.tab===ui.tab?"page":"false"));
  try{$("#app").innerHTML=({home:vHome,dates:vDates,find:vFind,list:vList})[ui.tab]()+dataFooter()}
  catch(e){reportError(e,"render");$("#app").innerHTML=`<section class="view"><div class="notice" role="alert"><div><b>This page couldn't load.</b> Your saved choices are safe. Try another tab, or reload the page.</div></div></section>`}
  renderSheet();
}
export function go(t){ui.tab=t;ui.openDbn=null;try{history.replaceState(null,"","#"+t)}catch(e){}render();window.scrollTo(0,0)}
