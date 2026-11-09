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

## Events we log (v1)

Kept small on purpose. No names, notes text, or home location in event properties.

| Event | When | Properties |
|---|---|---|
| `app_open` | Page load | `signed_in`, `tab` |
| `sign_in` | Sign-in completes | `method` (email, google), `claimed_local` (true/false) |
| `school_saved` / `school_removed` | Save toggled | `dbn` |
| `visit_marked` | "Yes, I went" | `event_id` |
| `step_done` | Step checked off | `step_id` |
| `sync_failed` | A save to the server fails | `table`, `error_code` |

---

## J1. First visit, signed out

**Goal:** see which schools fit, without creating an account.

1. Opens the site → **Home**: countdown, steps (step 1 is "You are here"), "Start here" notice.
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

1. Taps **Sign in** → chooses email link or Google.
2. Email: enters email → "Check your email" → taps link → back in the app, signed in.
3. App checks the account:
   - **No plan yet:** creates a household and uploads the local plan. Toast: "Your plan is saved to your account."
   - **Has a plan, device has nothing:** loads the account plan.
   - **Both have data:** merge. Saved schools: account order first, then new ones from the device. Visits, steps done: union. Notes: newer `updated` wins per school. Settings: account wins. Toast says what was merged.
4. From here on, every change saves to the account (debounced) and to `localStorage` as a cache.

**Stored:** `households`, `household_members`, `plans` and child tables; `sign_in` event.
**Failure cases:**
- Link expired or opened on another device → "This link expired. Send a new one." The local plan is untouched.
- Offline when signing in → no account call is made, the local plan stays, retry later.
- Merge can't reach the server halfway → don't clear local data until the upload is confirmed.

## J3. Come back later, on any device

**Goal:** pick up where I left off.

1. Opens the site (signed in on this device, or signs in again).
2. App loads the plan from the cache right away, then refreshes from the account.
3. Restores the last tab and last school sheet from `user_session`.
4. **Home** shows a **Next up** card, the most important first:
   - Open house I'm going to today or tomorrow
   - Visits that passed: "Did you go?"
   - Visited recently, no notes yet: "How was IS 187?"
   - Saved schools with no open house left, not planned
   - List not in order yet / not entered in MySchools
   - Days until the deadline

**Stored:** `user_session` updates on tab change and sheet open (debounced); `app_open` event.
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
2. Marks "Log in to MySchools and add your programs" done → Ready for MySchools guide stays available.
3. After Dec 11 → app switches to **submitted** mode: list is read-only, Home shows "Offers arrive April 7".
4. Apr 7, 2027 → step 8 becomes current: "See your offer in MySchools".
5. Next cycle (fall 2028) → a new `cycle`; last year's plan is archived, not mixed in.

**Failure cases:** device clock is wrong → dates come from the device today; acceptable, but the server time is used for any reminder sent by email later.

## J7. Leave, delete, or take my data

1. **Sign out** → clears the cached plan from this device (asks first: "Keep a copy on this device?").
2. **Export my data** → downloads a JSON file of the plan and notes.
3. **Delete my account** → confirm by typing DELETE → removes the person, and the household if they were the only member. Events are kept only without the user ID.

**Failure cases:** delete fails halfway → the server does it in one transaction; the app shows the error and nothing is half-deleted.

---

## Coverage by milestone

| Journey | Milestone |
|---|---|
| J1 First visit | M1 (port), M2 (data load errors) |
| J2 Sign in, claim local plan | M3 |
| J3 Come back, Next up | M4 |
| J4 Second parent | Schema in M3, feature after v1 |
| J5 Source data changes | M2 |
| J6 Deadline and after | M4 (submitted mode), already partly in MVP |
| J7 Sign out, export, delete | M5 |

Automated walk-throughs (Playwright) cover J1 from M1, and J2 and J3 once accounts exist.
