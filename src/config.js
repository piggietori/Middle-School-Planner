/* The account backend (Supabase). The publishable key is public by design: it only identifies the app.
   What each person can read or write is enforced by row-level security in supabase/migrations. */
export const SUPABASE_URL = "https://mhhszsyjxximewcuynis.supabase.co";
export const SUPABASE_KEY = "sb_publishable_eWugKpG_ZZYYZ5kCgX17iA_YV4_akzB";
// Where the Supabase library keeps the signed-in session in this browser.
export const SESSION_KEY = "sb-mhhszsyjxximewcuynis-auth-token";
// Where Supabase keeps the data (Dashboard → Project Settings → General), for the privacy notice.
export const SUPABASE_REGION = "REGION-TBD";

// While true, the header says "Pilot" and each device sees the pilot notice once (docs/launch.md).
export const PILOT = true;
// Where families report problems and ask about their data. It forwards to the owner.
export const HELP_EMAIL = "help@DOMAIN-TBD";
