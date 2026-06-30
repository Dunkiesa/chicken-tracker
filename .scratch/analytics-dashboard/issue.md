# Analytics Dashboard

## What to build

A dashboard (desktop view of the responsive app) that visualizes flock data. Metrics include production over time, average weight per chicken, most productive chicken, production consistency, egg weight variance, seasonal trends, "dry" period analysis, and attrition rate.

Attrition rate requires knowing when a chicken has left the flock, so this slice also introduces a chicken **departure/status** field, including the "Other" leaving reason with a free-text detail (per the PRD). The metrics are computed from the egg and chicken data and rendered as visualizations.

End-to-end: the departure/status field on the chicken, the API computing the metrics, and the dashboard rendering them.

## Acceptance criteria

- [ ] A chicken can be marked as having left the flock, with a reason (including an "Other" free-text detail)
- [ ] The dashboard displays production over time
- [ ] The dashboard displays average weight, most productive chicken, production consistency, and egg weight variance
- [ ] The dashboard displays "dry" period analysis and seasonal trends
- [ ] The dashboard displays an attrition rate derived from chicken departures
- [ ] Automated tests cover the metric computations

## Blocked by

- `.scratch/full-enrollment-dynamic-lists/issue.md`
- `.scratch/egg-logging/issue.md`

Triage: ready-for-agent
