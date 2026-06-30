# Quick Log

## What to build

A "Quick Log" affordance on the mobile view that minimizes taps while in the coop. The button defaults the date to today and pre-selects the most-recently-used chicken, so a typical egg entry needs only the weight.

End-to-end: the UI surfaces the Quick Log button with sensible defaults, and "most recently used chicken" is derived from prior egg-logging activity.

## Acceptance criteria

- [ ] A Quick Log button is available on the mobile view
- [ ] Quick Log defaults the date to the current day
- [ ] Quick Log pre-selects the most-recently-used chicken
- [ ] If the most-recently-used chicken is no longer eligible (e.g. departed), Quick Log falls back to no pre-selection
- [ ] A user can complete a Quick Log entry by supplying only the weight

## Blocked by

- `.scratch/egg-logging/issue.md`

Triage: ready-for-agent
