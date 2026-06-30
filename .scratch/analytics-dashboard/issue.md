# Analytics Dashboard

## What to build

A dashboard (desktop view of the responsive app) that visualizes flock data. Every metric obeys a single **date-range selector**, defaulting to the **last 12 months**.

Metrics:

- **Production over time** — egg counts per period (day / week / month, user-selectable) across the range, flock-wide and per hen.
- **Average weight** — mean egg weight per hen and flock-wide over the range.
- **Egg weight variance** — spread of a hen's egg weights (min / max / standard deviation), to spot abnormal eggs or a declining trend.
- **Most productive chicken** — hens ranked by egg count over the range; show all, with a top-N + "show all" fallback if the flock grows large.
- **Production consistency** — laying rate as a percentage: eggs laid ÷ days in the window, per hen.
- **Dry period** — per hen, the **current** dry streak (days since last egg) and the **longest historical** streak. Hens whose current streak crosses the threshold (configurable, **default 4 days**) are surfaced prominently, since a dry streak signals broodiness or molting and a change in care.
- **Seasonal trends** — production aggregated by calendar month / Southern-Hemisphere season across years (meaningful only once ~a year of data exists).
- **Attrition** — leads with a **breakdown of departures by reason** (counts per reason); the attrition rate (departures ÷ average flock size over the range) is shown as a secondary figure.

Production metrics are computed over **laying-eligible birds only** — roosters never appear in rankings or drag down averages. Departed birds' historical eggs remain included for the periods they were present (bounded by their departure date).

## Acceptance criteria

- [ ] All metrics respond to one date-range selector, defaulting to the last 12 months
- [ ] Production over time is shown per day/week/month, flock-wide and per hen
- [ ] Average weight and egg weight variance (min/max/std-dev) are shown per hen
- [ ] Most productive chicken ranks hens by egg count over the range
- [ ] Production consistency is shown as a laying-rate percentage per hen
- [ ] Dry period shows current and longest streak per hen, with hens past the threshold (default 4 days, configurable) surfaced prominently
- [ ] Seasonal trends aggregate production by month/season across years
- [ ] Attrition leads with a by-reason breakdown; the rate is secondary
- [ ] Roosters are excluded from production metrics; departed birds' history is retained within their active periods
- [ ] Automated tests cover the metric computations

## Blocked by

- `.scratch/full-enrollment-dynamic-lists/issue.md`
- `.scratch/egg-logging/issue.md`
- `.scratch/chicken-departure/issue.md`

Triage: ready-for-agent
