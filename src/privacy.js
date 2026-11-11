/* privacy.html: fill in the contact address, the data region and the pilot note from config.js. */
import {HELP_EMAIL, PILOT, SUPABASE_REGION} from "./config.js";

for (const a of document.querySelectorAll("[data-help]")) {
  a.href = `mailto:${HELP_EMAIL}?subject=${encodeURIComponent("D20 Middle School Planner")}`;
  if (a.textContent === "us") a.textContent = HELP_EMAIL;
}
for (const el of document.querySelectorAll("[data-region]")) el.textContent = SUPABASE_REGION;
for (const el of document.querySelectorAll("[data-pilot]")) el.hidden = !PILOT;
