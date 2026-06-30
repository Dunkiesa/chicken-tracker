# Full Enrollment + Dynamic Lists

## What to build

Expand chicken enrollment to the complete field set: Sex (Hen / Rooster / Unknown), Breed, Origin Source, and Acquisition Type. Breed, Origin, and Acquisition Type are backed by dynamic lists — when an admin enters a value that does not yet exist, it is added to the list and offered as a choice thereafter. Sex is a fixed enumeration.

End-to-end: the enrollment form presents the dynamic lists as selectable values with the ability to add new ones, the API persists both the chicken and any new list values, and the data stays consistent across enrollments.

## Acceptance criteria

- [ ] A chicken can be enrolled with Sex, Breed, Origin Source, and Acquisition Type
- [ ] Sex is constrained to Hen / Rooster / Unknown
- [ ] Entering a new Breed / Origin / Acquisition value adds it to the corresponding dynamic list
- [ ] Previously entered dynamic-list values are offered as choices on subsequent enrollments
- [ ] Automated tests cover dynamic-list growth and chicken persistence

## Blocked by

- `.scratch/google-auth-roles/issue.md`

Triage: ready-for-agent
