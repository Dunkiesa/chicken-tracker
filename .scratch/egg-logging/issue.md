# Log an Egg

## What to build

A mobile-friendly view for logging daily egg production. The user selects a chicken, enters the egg's weight and date, and saves it. The system enforces at most one egg per chicken per day.

End-to-end: the mobile view lists chickens to choose from, the API persists the egg against the chicken, and the one-per-day rule is enforced server-side.

## Acceptance criteria

- [ ] The mobile view lists chickens to log against
- [ ] A user can enter and save an egg's weight and date for a chosen chicken
- [ ] Logging a second egg for the same chicken on the same date is rejected
- [ ] Automated tests cover the one-egg-per-chicken-per-day constraint

## Blocked by

- `.scratch/google-auth-roles/issue.md`

Triage: ready-for-agent
