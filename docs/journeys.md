# User journeys

How families move through the planner, what each step stores, and what can go wrong.
Written for v1 (data foundations, accounts, pick up where you left off). Each journey says
what the MVP does today and what changes in v1, so we can build and test against it.

**Who:** a parent or guardian in Brooklyn District 20 applying for fall 2027 middle school.
v1 starts with one household; the same design must work for many households later.

**Key dates (cycle 2027):** applications open Oct 14, 2026 · deadline Dec 11, 2026 · offers Apr 7, 2027.

## What we store

| Data | Kind | Where in MVP | Where in v1 |
|---|---|---|---|
| Schools, open houses, key dates, neighborhoods, steps | Source data (public) | Hard-coded in `index.html` | `data/*.json`, versioned, with `source` and `as_of` |
| Home, travel distance, subway, hide competitive, priorities (`w`), programs | Plan (household) | `localStorage["d20plan"]` | `plans` row |
| Saved schools in order | Plan | `st.saved` | `saved_schools(dbn, rank)` |
| Open houses going / visited | Plan | `st.going`, `st.attended` | `visits(event_id, status)` |
| Steps marked done | Plan | `st.done` | `step_progress(step_id, done_at)` |
| Our notes (rating, likes, concerns) | Plan | `st.notes` | `school_notes` |
| Last tab, last school open, last view | Session (person) | URL hash only (`#find`) | `user_session` |
| Usage events, errors | Telemetry | None | `events`, `client_errors` |

Plan data belongs to the **household** so two parents can share one plan. Session data belongs
to the **person**, so each parent resumes where *they* left off.

Every reference from user data to source data uses a stable ID: school DBN (`20K187`),
event ID (`oh-20K187-2026-11-10-1730`, `k-close`), step ID (`s3`). Source data can change
without breaking a saved plan.

## Events we log (v2)

Kept small on purpose. No names, notes text, or home location in event properties. Sent a few seconds after they
happen, from every visit to the live site (`src/log.js`): signed in, with the person's ID; signed out, with no user.
Every event carries `visit`, a random ID made on each page load and never stored, so a signed-out visit can't be
linked to the next. Not sent from `localhost` (turn on with `localStorage["d20-usage-test"]="1"`). Errors nobody
caught go to `client_errors` (message, stack, where, browser), at most 10 per visit. At most 300 events per visit.
The owner's reports on them: [operations.md](operations.md#usage-reports).

| Event | When | Properties |
|---|---|---|
| `app_open` | Page load, once we know whether they're signed in | `tab`, `signed_in` |
| `tab_view` | A tab opened | `tab` |
| `school_opened` | A school's details opened | `dbn`, `from` (tab) |
| `preference_set` | A Find answer changed | `what` (neighborhood, distance, priority, program, subway, competitive), never the value |
| `going_marked` | "I'm going" | `event_id` |
| `note_added` | A rating, like or concern added | `part` (rating, pros, cons), never the text |
| `list_view` | My list's Compare or Finalize & apply opened | `view` |
| `list_copied` | A code or the whole list copied for MySchools | `what` (code, all) |
| `feedback_sent` | Feedback sent | `kind` |
| `sign_in` | First sign-in on a device | `method` (code), `claimed_local` (true/false) |
| `school_saved` / `school_removed` | Save toggled | `dbn` |
| `visit_marked` | "Yes, I went" | `event_id` |
| `step_done` | Step checked off | `step_id` |
| `sync_failed` | A save to the server fails | `error_code` |

---

## J1. First visit, signed out

**Goal:** see which schools fit, without creating an account.

1. Opens the site → **Home**: countdown, steps (step 1 is "You are here"), "New here?" tip (Find schools first, the plan stays on this device; Sign in to save or open it from another device; only while the plan is still empty; it goes away for good after the first choice). Reminders (deadline, upcoming visits, "Did you go?", notes nudges) share one box on Home.
2. Goes to **Find schools** → picks neighborhood, travel distance, priorities, programs. The list re-ranks as they go.
3. Opens a school → detail sheet → **Save**. Step 1 and step 2 check off.
4. Goes to **Dates** → "I'm going" on an open house → "Add to my calendar".

**Stored:** everything in `localStorage` on this device only (same as MVP).
**v1 change:** a quiet "Sign in to keep your plan on all your devices" prompt after the first save. Never required.
**Failure cases:**
- Private browsing or blocked storage → the app still works for this visit. Show "Your choices won't be kept after you close this tab".
- Source data file fails to load → show a full-page error with a retry. Don't show an empty school list as if no schools match.

## J2. Sign in and keep what I already did

**Goal:** turn the plan on this device into an account plan.

1. Taps **Sign in** → enters email → **Email me a code**.
2. "Check your email" → types the 6-digit code from the email, in the same browser → signed in. If the page reloads
   while they read the email (common on phones), the code box comes back for the 30 minutes the code works.
3. App checks the account:
   - **No plan yet:** creates a household and uploads the local plan. Toast: "Your plan is saved to your account."
   - **Has a plan, device has nothing:** loads the account plan.
   - **Both have data:** merge. Saved schools: account order first, then new ones from the device. Visits, steps done: union. Notes: newer `updated` wins per school. Settings: account wins. Toast says what was merged.
4. From here on, every change saves to the account (debounced) and to `localStorage` as a cache.

**Stored:** `households`, `household_members`, `plans` and child tables; `sign_in` event.
**Failure cases:**
- A link that carries a sign-in or an error (from an email sent before v1.3.0, or made by someone else) → never accepted: "That sign-in link has expired" and how to get a code. The local plan is untouched and no account is contacted.
- Wrong or expired code → "That code didn't work or has expired." The box keeps what they typed.
- The plan on the device was last synced with a different account (a shared computer, or someone else's sign-in lapsed) → ask "Whose plan is on this device?" before merging. **No** shows the account's plan and adds nothing; **Yes** merges as above.
- Offline when signing in → no account call is made, the local plan stays, retry later.
- Merge can't reach the server halfway → don't clear local data until the upload is confirmed.

## J3. Come back later, on any device

**Goal:** pick up where I left off.

1. Opens the site (signed in on this device, or signs in again).
2. App loads the plan from the cache right away, then refreshes from the account.
3. Opens where they left off: the tab, that tab's view (calendar or list, order or compare) and the school sheet if one was open.
   - Same device: from this device (`localStorage` `d20session`). A link to a different tab (`#dates`) wins.
   - Another device: after signing in, from `user_session`, if it's newer than this device's and they haven't moved yet.
4. **Home** shows a **Next up** card, the most urgent first:
   - Deadline in 7 days or fewer
   - Open house I'm going to in the next 2 days
   - Visits that passed: "Did you go?" (up to 3, then "and N more on Dates")
   - Visited in the last 2 weeks, no notes yet: "How was IS 187?"
   - Deadline in 8 to 21 days
   - Nothing urgent: the next step on the checklist, with a button to do it. After the deadline: when offers arrive.

**Stored:** `d20session` on this device on every tab, view or sheet change; `user_session` (signed in) a moment later, or when the page is hidden. `app_open` event in M5.
**Failure cases:**
- Server plan is newer than the cache → replace the screen quietly, keep any unsaved typing in the notes boxes (the MVP already does this with `commitDrafts`).
- Saved school or event no longer in source data → keep it, show "No longer listed" instead of hiding it.
- Signed-out session expired → show the cached plan read-only with "Sign in again to keep editing".

## J4. Second parent joins the household *(schema in v1, feature later)*

**Goal:** both parents see and edit the same plan.

1. Parent A: **Share plan** → gets an invite link (one-time, expires in 7 days).
2. Parent B opens the link → signs in → joins the household. If B already had a plan, B chooses: keep mine, or join.
3. Both see the same saved schools, visits, notes. Each has their own `user_session`.

**Stored:** `household_members` row with `role` (owner, member); `invites` table.
**Failure cases:** both edit the same note at once → last write wins per school note; show "Updated by the other parent" toast when a newer version arrives.

## J5. Source data changes

**Goal:** families see correct dates and facts without losing their plan.

1. A source changes → the weekly *Watch sources* issue (or the August checklist) says what to update → a person edits `data/*.json`, or runs *Refresh data* for test results → pull request with a readable diff → approved → deployed.
2. On next open, the app compares the data `as_of` with what this plan last saw.
3. If something on *my* plan changed (open house moved, cancelled, time changed) → notice on Home and a "Changed" pill on that date.
4. Footer shows "School data updated Nov 9, 2026".

**Stored:** `plans.data_seen_as_of`.
**Failure cases:** an event ID changes because the time changed (IDs include the start time) → the refresh job must keep the old ID and record the new time, or write a redirect from old ID to new ID. Data checks block any change that drops an ID that plans may reference.

## J6. Deadline and after

**Goal:** submit on time, then know what's next.

1. 21 days before Dec 11 → "Deadline soon" notice (MVP already does this).
2. Long before that, My list says the list doesn't count until it's submitted in MySchools, Home marks steps 6 and 7
   **Required · in MySchools**, with a button to **Finalize & apply** (My list): finalize the
   order, then the steps from logging in to the confirmation, with the codes in order. "I submitted in MySchools" marks steps 6 and 7
   done and stops the deadline reminders. The planner can't see MySchools, so this is only what the family tells it.
   If any of Find's top 3 matches (Good match or better) isn't on the list, My order and step 1 of Finalize & apply
   flag it ("One of your top 3 matches is not on your list"), with **☆ Save**, **See details** and **Dismiss** (hidden
   on this device until a different school is missing) (only once a neighborhood is set and something is saved, and until
   applications close).
3. After Dec 11 → My list is read-only ("This is your list as it was then", no arrows) with who to contact if they
   didn't submit, and Next up says when offers arrive.
4. Apr 7, 2027 → Next up: "Offers are out. See your child's offer in MySchools."
5. Next cycle (fall 2028) → a new `cycle`; last year's plan is archived, not mixed in.

**Failure cases:** device clock is wrong → dates come from the device today; acceptable, but the server time is used for any reminder sent by email later.

## J7. Leave, delete, or get a copy of my data

1. **Sign out** → asks "Keep a copy of your plan on this device?": keep it, or remove it (for a shared computer). The account keeps the plan either way.
2. **Delete my account** → confirm by typing DELETE, and choose whether to remove the plan from this device too → removes the person, and the household if they were the only member. Events and errors are kept without the user ID.
3. **A copy of my data** → there's no download button (a data file meant nothing to families): they email `help@`, and the owner sends what the account holds ([privacy.md](privacy.md)).

**Failure cases:** delete fails halfway → the server does it in one transaction; the app shows the error and nothing is half-deleted.

**Signed out without choosing it:**
- The sign-in ends on its own (Supabase ended the session, or it's gone at the next visit) → the plan stays on the device; a toast and Home say "Signed out on this device: your plan is still here", and the sign-in sheet says "Sign in again" with the email filled in. Signing in merges anything changed meanwhile. "Not you? Forget this email" clears it on a shared computer.
- The browser lost everything (site data cleared, a cleaner app, a new device, a different address) → the device can't know there was an account, so the blank start's "New here?" tip says "Sign in if you want to save or access your plan from another device"

---

## Coverage by milestone

| Journey | Milestone |
|---|---|
| J1 First visit | M1 (port), M2 (data load errors) |
| J2 Sign in, claim local plan | M3 |
| J3 Come back, Next up | M4 (done) |
| J4 Second parent | Schema in M3, feature after v1 |
| J5 Source data changes | M2 |
| J6 Deadline and after | M4 (submitted mode, done), partly in MVP |
| J7 Sign out, export, delete | M5 (done) |

Automated walk-throughs (Playwright) cover J1 from M1, and J2 and J3 once accounts exist.
