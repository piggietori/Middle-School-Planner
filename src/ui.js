/* Screen state that is not part of the plan: which tab, filter, month or school sheet is showing. */
let tab = (location.hash||"").slice(1);
if(!["home","dates","find","list"].includes(tab)) tab="home";
export const ui = {tab, dateFilter:"all", openDbn:null, dateView:"cal", calMonth:null, selDay:null, openStep:null, listView:"order", prefsOpen:false};
