# Plan 025f: Write RosterPage tests

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

`RosterPage` is one of the most complex pages, handling auth guards, role-based UI, data fetching, and form submission for adding chickens.

## Current state

`src/app/roster/page.tsx` manages state for the chicken list and the enrollment form.

## Commands you will need

| Purpose      | Command                                       | Expected on success |
|--------------|-----------------------------------------------|---------------------|
| Unit tests   | `npx jest --config jest.component.config.ts tests/components/RosterPage.test.tsx` | all pass            |
| Typecheck    | `npx tsc --noEmit`                            | exit 0              |

## Scope

**In scope**:
- `tests/components/RosterPage.test.tsx` (CREATE)

**Out of scope**:
- Modifying `src/app/roster/page.tsx`

## Git workflow

- Branch: `improve/025f-rosterpage-tests`
- Commit: `test: add component tests for RosterPage`
- Do NOT push or open a PR

## Steps

### Step 1: Write `RosterPage.test.tsx`

Create `tests/components/RosterPage.test.tsx`. This is the most complex test file. Mock `fetch` globally for the data-fetching calls. Test cases:

1. **Shows loading state** — mock `status: "loading"`, verify "Loading..." text.
2. **Redirects to / when unauthenticated** — mock `status: "unauthenticated"`, verify `router.replace("/")` was called.
3. **Shows enroll form for admins** — mock admin role, mock `fetch` to return empty arrays, verify "Add Chicken" button is present.
4. **Hides enroll form for viewers** — mock viewer role, verify "Add Chicken" button is absent, verify "only admins can add" message.
5. **Shows chicken list** — mock fetch to return a chicken array with one active hen, verify chicken name appears in the table.

**Verify**: `npx jest --config jest.component.config.ts tests/components/RosterPage.test.tsx` — all tests pass.

## Done criteria

- [ ] `tests/components/RosterPage.test.tsx` created and all tests pass
- [ ] `npx tsc --noEmit` exits 0

## STOP conditions

- If the `RosterPage` auth guard or redirect logic changes.
- If the `fetch` calls in `RosterPage` use a different URL pattern or parameters.

## Maintenance notes

- `RosterPage` tests are complex and rely heavily on `fetch` mocks. Ensure they are kept up to date with any changes to the `RosterPage` data structure or API requirements.
