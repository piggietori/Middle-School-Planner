# How the planner works

Start with architecture, then read whichever doc answers your question. Each fact lives in one doc, and the others link to it.

| Doc | Answers |
|---|---|
| [architecture.md](architecture.md) | How the pieces fit, what data lives where, how a plan syncs between devices |
| [data-sources.md](data-sources.md) | Where school and date data comes from, how often it's refreshed, how a change reaches the site, what the checks catch |
| [backups.md](backups.md) | How a family's plan is backed up, and how to restore it |
| [security.md](security.md) | How data is protected, layer by layer, and the known gaps |
| [secrets.md](secrets.md) | Every key and password: where it lives, and what to do if one is lost or leaked |
| [privacy.md](privacy.md) | What personal data exists, who can see it, and how long it's kept |
| [operations.md](operations.md) | The yearly calendar, monitoring and alerts, feedback, the banner, and what to do when something breaks |
| [launch.md](launch.md) | Opening the planner to other families: the setup checklist, the pilot, and when to share more widely |
| [testing.md](testing.md) | The test and eval layers, what each proves, and how to run them |
| [journeys.md](journeys.md) | What families do in the planner, step by step |
| [CHANGELOG.md](../CHANGELOG.md) | What changed in each version, and how to release one |

Setting up Supabase and adding database changes: [supabase/README.md](../supabase/README.md).
Running the site locally: [README.md](../README.md#development).
