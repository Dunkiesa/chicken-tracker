# Dynamic List Management (Admin)

## What to build

An Admin screen to keep the Breed, Origin Source, and Acquisition Type dynamic lists clean. Even with pick-first entry and case-insensitive matching, duplicates and typos will occasionally slip in ("Rhode Island Red" vs "RIR"). Admins can **rename** a value, **remove** an unused value, and **merge** two values — merging re-points every chicken using the duplicate onto the canonical value so the dashboard groups them correctly.

## Acceptance criteria

- [ ] An Admin can rename a dynamic-list value
- [ ] An Admin can remove a dynamic-list value that is not in use
- [ ] An Admin can merge two values; all chickens referencing the merged-away value are re-pointed to the canonical value
- [ ] The screen is Admin-only; Viewers cannot access it
- [ ] Automated tests cover rename, remove, and merge (including re-pointing)

## Blocked by

- `.scratch/full-enrollment-dynamic-lists/issue.md`

Triage: ready-for-agent
