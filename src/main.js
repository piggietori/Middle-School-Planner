/* Entry point. Loads the app and its data; if anything fails to load, say so instead of showing a blank page. */
import("./app.js").catch(e=>{
  console.error(e);
  // A SyntaxError means this browser is too old to read the planner's code; trying again won't help.
  const old=e instanceof SyntaxError;
  document.getElementById("app").innerHTML=`<section class="view"><div class="notice" role="alert"><div>
    <b>The planner couldn't load.</b> ${old?"This browser is too old for it. Update your phone or browser, or open the planner on a newer device.":"Check your internet connection and try again."} Your saved choices are safe on this device.
    <div class="row" style="margin-top:10px"><button class="btn primary" id="retry">Try again</button></div></div></div></section>`;
  document.getElementById("retry").addEventListener("click",()=>location.reload());
});
