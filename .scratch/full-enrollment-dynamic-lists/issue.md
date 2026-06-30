# Full Enrollment + Dynamic Lists

## What to build

Expand chicken enrollment to the complete field set: Sex (Hen / Rooster / Unknown), Breed, Origin Source, and Acquisition Type. Breed, Origin, and Acquisition Type are backed by dynamic lists. Entry is **pick-first**: the form shows existing values to choose from, and typing a genuinely new one (which adds it to the list) is the secondary path. Matching is **case-insensitive and trimmed**, so "rhode island red" resolves to an existing "Rhode Island Red" rather than creating a duplicate. Sex is a fixed enumeration. (Cleanup of duplicates that still slip in — rename/remove/merge — is a separate Admin slice.)

End-to-end: the enrollment form presents the dynamic lists as selectable values with the ability to add new ones, the API persists both the chicken and any new list values, and the data stays consistent across enrollments.

## Acceptance criteria

- [ ] A chicken can be enrolled with Sex, Breed, Origin Source, and Acquisition Type
- [ ] Sex is constrained to Hen / Rooster / Unknown
- [ ] The form presents existing dynamic-list values to pick first; adding a new value is the secondary path
- [ ] Dynamic-list matching is case-insensitive and trimmed, so near-duplicates resolve to the existing value
- [ ] Entering a genuinely new Breed / Origin / Acquisition value adds it to the corresponding dynamic list
- [ ] Previously entered dynamic-list values are offered as choices on subsequent enrollments
- [ ] Automated tests cover dynamic-list growth and chicken persistence

## Blocked by

- `.scratch/google-auth-roles/issue.md`

Triage: ready-for-agent
