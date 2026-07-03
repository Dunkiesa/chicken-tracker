# Plan 025d: Write UserMenu tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9f05e7b..HEAD -- src/components/ tests/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L (Shared with 025)
- **Risk**: LOW
- **Depends on**: 025a
- **Category**: tests
- **Planned at**: commit `9f05e7b`, 2026-07-03

## Why this matters

The `UserMenu` provides the primary way for users to view their status and sign out. Interactive elements like dropdowns need to be tested to ensure usability.

## Current state

`src/components/UserMenu.tsx` handles the dropdown state and role-based badge styling.

## Commands you will need

| Purpose      | Command                                       | Expected on success |
|--------------|-----------------------------------------------|---------------------|
| Unit tests   | `npx jest --config jest.component.config.ts tests/components/UserMenu.test.tsx` | all pass            |
| Typecheck    | `npx tsc --noEmit`                            | exit 0              |

## Scope

**In scope**:
- `tests/components/UserMenu.test.tsx` (CREATE)

**Out of scope**:
- Modifying `src/components/UserMenu.tsx`

## Git workflow

- Branch: `improve/025d-usermenu-tests`
- Commit: `test: add component tests for UserMenu`
- Do NOT push or open a PR

## Steps

### Step 1: Write `UserMenu.test.tsx`

Create `tests/components/UserMenu.test.tsx`. Test cases:

1. **Shows user email and role when closed** — mock session with email and role, verify button text contains email and role badge.
2. **Opens dropdown on click** — click the button, verify the dropdown menu appears with email and sign-out button.
3. **Closes dropdown on outside click** — open dropdown, click outside, verify dropdown closes.
4. **Shows correct role badge color for Admin vs Viewer** — test `role: "Admin"` and `role: "Viewer"` produce different badge styling.

**Verify**: `npx jest --config jest.component.config.ts tests/components/UserMenu.test.tsx` — all tests pass.

## Done criteria

- [ ] `tests/components/UserMenu.test.tsx` created and all tests pass
- [ ] `npx tsc --noEmit` exits 0

## STOP conditions

- If the dropdown state logic in `UserMenu` was moved to a custom hook or changed significantly.
- If outside click behavior is no longer handled via standard methods.

## Maintenance notes

- Ensure the `UserMenu` test uses the setup utilities from `tests/components/setup.ts`.
