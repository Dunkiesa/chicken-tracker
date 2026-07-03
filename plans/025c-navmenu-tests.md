# Plan 025c: Write NavMenu tests

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

`NavMenu` controls access to sensitive pages (Log, Roster, Admin). Testing the role-based visibility is critical for security and usability.

## Current state

`src/components/NavMenu.tsx` renders links based on user roles.

## Commands you will need

| Purpose      | Command                                       | Expected on success |
|--------------|-----------------------------------------------|---------------------|
| Unit tests   | `npx jest --config jest.component.config.ts tests/components/NavMenu.test.tsx` | all pass            |
| Typecheck    | `npx tsc --noEmit`                            | exit 0              |

## Scope

**In scope**:
- `tests/components/NavMenu.test.tsx` (CREATE)

**Out of scope**:
- Modifying `src/components/NavMenu.tsx`

## Git workflow

- Branch: `improve/025c-navmenu-tests`
- Commit: `test: add component tests for NavMenu`
- Do NOT push or open a PR

## Steps

### Step 1: Write `NavMenu.test.tsx`

Create `tests/components/NavMenu.test.tsx`. Test cases:

1. **Shows Log and Roster links for viewers** — mock viewer role, verify "Log" and "Roster" links are present, "Dashboard" and "Admin" are absent.
2. **Shows Dashboard and Admin links for admins** — mock admin role, verify all four links present.
3. **Each link has correct href** — verify Log → `/log-egg`, Dashboard → `/`, Roster → `/roster`, Admin → `/admin`.

**Verify**: `npx jest --config jest.component.config.ts tests/components/NavMenu.test.tsx` — all tests pass.

## Done criteria

- [ ] `tests/components/NavMenu.test.tsx` created and all tests pass
- [ ] `npx tsc --noEmit` exits 0

## STOP conditions

- If `NavMenu` role logic changed significantly.
- If mock `useSession` doesn't correctly reflect the role for `NavMenu`.

## Maintenance notes

- Ensure the `NavMenu` test uses the setup utilities from `tests/components/setup.ts`.
