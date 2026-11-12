# The services behind the planner, in plain words

The planner runs on a handful of free online services. This page explains what each one does, how they connect, and
what families would notice if one stopped working. No technical background is needed. For the code and data in
detail, see [architecture.md](architecture.md).

## The cast

| Service | Think of it as | What it does here | Cost |
|---|---|---|---|
| **Porkbun** | The street address | Owns the name `torilam.com`. It tells browsers that `d20.torilam.com` lives at GitHub Pages, and tells inboxes that `d20mail.torilam.com` mail really comes from Resend | Yearly domain fee, on auto-renew |
| **GitHub** (public repo `Middle-School-Planner`) | The workshop | Holds every file of the planner and its history. Every proposed change (a "pull request") is tested automatically before it's accepted | Free |
| **GitHub Pages** | The shop window | Shows the finished site to the world at `d20.torilam.com`. Updates itself each time a change is accepted | Free |
| **Supabase** | The locked filing cabinet, and the front desk | Stores saved plans for families who sign in, and checks who they are with an emailed code. Each family can only open its own drawer | Free plan |
| **Resend** | The post office | Delivers the planner's emails: sign-in codes to families, and feedback messages to the owner | Free plan (100 emails a day) |
| **GitHub** (private repo `planner-ops`) | The back office | Runs the jobs that touch families' data: the encrypted backups and the hourly health check. Private, so nobody else can see their output | Free |
| **healthchecks.io** | The smoke detector's battery alarm | Expects a "still alive" signal from the health check. If the signals stop, it emails the owner | Free |
| **The owner's inbox** (Gmail, or GitHub Mobile) | The alarm bell | Where alerts, feedback and failures arrive | Free |

## The big picture

```
                         ┌───────────────┐
   family types          │    PORKBUN    │  "d20.torilam.com is over at GitHub Pages"
   d20.torilam.com ────► │ (the address) │  "mail from d20mail.torilam.com is genuine"
                         └───────┬───────┘
                                 ▼
 ┌──────────────┐  publish  ┌──────────────┐  the page   ┌───────────────────────┐
 │ GITHUB repo  │─────────► │ GITHUB PAGES │───────────► │  FAMILY'S BROWSER     │
 │ (workshop)   │ on merge  │ (shop window)│             │  plan kept on device  │
 └──────────────┘           └──────────────┘             └──────────┬────────────┘
                                                                    │ sign in, sync plan,
                                                                    │ send feedback
                                                                    ▼
 ┌──────────────┐  starts jobs (the "clock")   ┌───────────────────────────────────┐
 │ PLANNER-OPS  │◄─────────────────────────────│ SUPABASE (filing cabinet)         │
 │ (back office)│                              │ accounts · plans · feedback ·     │
 │ backup,      │── reads counts, copies ────► │ locked "Vault" for keys           │
 │ monitor      │   encrypted backup           └─────────────────┬─────────────────┘
 └──┬───────┬───┘                                               │ "please send this email"
    │       │ "still alive"                                     ▼
    │       ▼                                          ┌──────────────────┐
    │  ┌───────────────┐                               │ RESEND (post     │
    │  │HEALTHCHECKS.IO│                               │ office)          │
    │  └──────┬────────┘                               └───┬──────────┬───┘
    │ ALERT   │ "pings stopped"           sign-in codes    │          │ feedback
    ▼ issues  ▼                                            ▼          ▼
 ┌─────────────────────────────┐              ┌─────────────┐  ┌──────────────────┐
 │ OWNER'S INBOX / GitHub app  │◄─────────────┼─────────────┼──│ (owner's inbox)  │
 └─────────────────────────────┘              │family inbox │  └──────────────────┘
                                              └─────────────┘
```

## Five everyday journeys

### 1. A family opens the site

```
browser ──"where is d20.torilam.com?"──► PORKBUN ──"at GitHub Pages"──► GITHUB PAGES ──page──► browser
```

The whole planner loads from GitHub Pages: the schools, the dates, and the tools. A family who never signs in uses
only these two services. Their plan stays on their own device and is never sent anywhere.

### 2. A family signs in

```
browser ──"email me a code"──► SUPABASE ──hands the email to──► RESEND ──► family's inbox
                                                                 (from signin@d20mail.torilam.com)
family types the code ──► SUPABASE: "yes, that's you" ──► plan syncs between their devices
```

Porkbun vouches for Resend: it publishes records saying Resend may send for `d20mail.torilam.com`, so the email
doesn't land in spam.

### 3. Someone sends feedback

```
browser ──message──► SUPABASE stores it ──► opens the Vault: Resend key, owner's address, sender name
                                        ──► RESEND ──► owner's inbox (from "D20 Middle School Planner")
```

The keys never leave Supabase's Vault. The site itself never knows them.

### 4. The owner publishes a change

```
change proposed (pull request) ──► GITHUB runs the checks: tests on desktop, Android, iPhone
        ──all pass──► merged ──► GITHUB PAGES updates d20.torilam.com within minutes
```

A change that fails a check can't be merged.

### 5. Keeping watch, around the clock

```
SUPABASE clock ──every hour──► PLANNER-OPS "Monitor": is the site up? errors? saves failing? backups recent?
                                   │ problem? ──► opens an "ALERT:" issue ──► GitHub emails the owner
                                   └ always   ──► "still alive" to HEALTHCHECKS.IO
HEALTHCHECKS.IO: no signal for 4+ hours ──► emails the owner (the monitor itself has stopped)

SUPABASE clock ──daily in Oct–Dec──► PLANNER-OPS "Backup": an encrypted copy of the database, kept 90 days
```

The database starts these jobs itself, because GitHub's own timers often run hours late. GitHub's timers stay on
as a backup, so sometimes a job runs twice. That's harmless.

## Where the keys live

Each service has a password or key, and each is kept in exactly one place. None are in the code.

| Key | Kept in |
|---|---|
| Resend keys (for sign-in emails and feedback) | Supabase only |
| Database password, backup passphrase | `planner-ops` secrets (the passphrase also in the password manager) |
| The clock's GitHub token | Supabase Vault only |
| healthchecks.io ping address | `planner-ops` secrets |
| Logins to Porkbun, GitHub, Supabase, Resend, email | Password manager, each with two-step sign-in |

Details, and what to do if one leaks: [secrets.md](secrets.md).

## If one piece stops working

| If this stops | Families notice | The owner hears from |
|---|---|---|
| Porkbun (domain lapses) | The site is gone, and sign-in emails stop | The Monitor ("Site up" alert) |
| GitHub Pages | The site doesn't load | The Monitor |
| Supabase | Can't sign in or sync; the plan on their device still works | The Monitor ("Supabase up") |
| Resend | No sign-in codes; feedback isn't emailed (it's still saved) | The Monitor ("Feedback not emailed", "Emails and clock calls") |
| `planner-ops` / the Monitor | Nothing | healthchecks.io |
| healthchecks.io | Nothing | Nobody, until the Monitor also fails. Low risk, since both rarely fail together |

What to do in each case: [operations.md](operations.md) and [failure-modes.md](failure-modes.md).
