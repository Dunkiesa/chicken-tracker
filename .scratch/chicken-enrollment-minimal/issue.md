# Enroll & List a Chicken (Minimal)

## What to build

The thinnest real domain slice. A `Chicken` record with an auto-assigned unique ID and a name — nothing else yet. The API supports creating a chicken and listing chickens. The web app has a form to add a chicken and a list view showing the enrolled chickens with their IDs.

Keep the schema deliberately minimal here; richer enrollment fields (sex, breed, origin, acquisition type) arrive in a later slice. No authentication yet — that is layered on in the next slice.

## Acceptance criteria

- [ ] Creating a chicken assigns a unique ID automatically
- [ ] Chicken names are unique across the flock (and not reused, including after a bird departs)
- [ ] The API supports creating a chicken (name) and listing all chickens
- [ ] The web app provides a form to add a chicken and a list view that shows enrolled chickens
- [ ] Automated tests cover create and list behavior of the API

## Blocked by

- `.scratch/walking-skeleton/issue.md`

Triage: ready-for-agent
