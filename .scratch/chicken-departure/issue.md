# Chicken Departure / Status

## What to build

A chicken can leave the flock (died/illness, sold, predator, gave away, or **Other** with a free-text detail). Departure is a **status change** with a **date** and a **structured reason** — never a delete. All of a departed bird's history (eggs, photos, notes) is retained permanently.

A departed bird drops out of active workflows: it disappears from the egg-logging picker and from the default chicken list, with a **"show departed" toggle** to reveal it. Its profile remains fully viewable and you can still add notes (e.g. cause of death, sale details).

The reason is the **primary** signal (it drives coop-security and care decisions), so it is a defined, selectable set with an Other + free-text option. The departure date bounds the bird's contribution to time-based dashboard metrics.

## Acceptance criteria

- [ ] A chicken can be marked departed with a date and a structured reason (died/illness, sold, predator, gave away, Other + free text)
- [ ] Departure is a status change; the chicken and all its history are retained, never deleted
- [ ] Departed birds are removed from the egg-logging picker and the default chicken list
- [ ] A "show departed" toggle reveals departed birds in the list
- [ ] A departed bird's profile remains viewable and notes can still be added
- [ ] Automated tests cover departure, history retention, and exclusion from active flows

## Blocked by

- `.scratch/full-enrollment-dynamic-lists/issue.md`

Triage: ready-for-agent
