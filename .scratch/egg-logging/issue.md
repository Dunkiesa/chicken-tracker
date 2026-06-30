# Log an Egg

## What to build

A mobile-friendly view for logging daily egg production over the local network. The user picks the chicken that laid the egg — always **exactly one** (attribution is the user's call, even for the ~1% they resolve by judgment) — enters the egg's weight and date, and saves it.

Because the user sometimes decides between a few candidate hens based on recent laying and egg characteristics, the logging screen surfaces, for each selectable hen, her **recent laying context** (e.g. last egg date, recent typical weight) so the choice is informed rather than blind.

Only **laying-eligible** birds appear in the picker: Hens and Unknown-sex birds. **Roosters are hidden by default**, with a "show all" escape hatch for mis-sexed birds. Eligibility follows the chicken's current sex value (correctable later).

At most one egg per chicken per day is expected, but this is a **soft, overridable warning** — not a hard block. Logging a second egg for the same chicken on the same date prompts "already logged today, add another anyway?" rather than refusing, so genuine double-lays and corrections are painless.

Eggs can be **edited** (weight, date, chicken) and **deleted** after logging. Viewers can edit/delete their own entries; Admins can edit/delete any.

Weight is in **grams to 2 decimal places** (e.g. 58.34 g). Values outside a sanity range (~20–200 g) raise a soft warning, consistent with the per-day rule, but are not blocked.

The picker is a simple visual list (name; photo thumbnail once photos exist) suited to ~20 birds, with an unobtrusive **search/filter** so it remains usable toward the ~100 ceiling.

## Acceptance criteria

- [ ] The picker lists laying-eligible chickens (Hens and Unknown); Roosters are hidden by default with a "show all" option
- [ ] Each selectable hen shows recent laying context (last egg date, recent typical weight) to inform attribution
- [ ] An egg is always attributed to exactly one chicken
- [ ] A user can enter and save an egg's weight (grams, 2 decimals) and date
- [ ] A second egg for the same chicken on the same date raises an overridable warning, not a hard rejection
- [ ] Weights outside ~20–200 g raise a soft warning but are not blocked
- [ ] Eggs can be edited (weight, date, chicken) and deleted; Viewers manage their own entries, Admins any
- [ ] The picker offers search/filter so it scales from ~5 to ~100 birds
- [ ] Automated tests cover attribution, the soft per-day warning + override, weight precision/validation, and edit/delete

## Blocked by

- `.scratch/full-enrollment-dynamic-lists/issue.md`

Triage: ready-for-agent
