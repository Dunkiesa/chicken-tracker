# Plan 025b: Write AppShell tests

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

The `AppShell` component handles auth-gating logic for the main navigation and footer. Without tests, we risk breaking the primary navigation or auth-based UI visibility for all users.

## Current state

`src/components/AppShell.tsx` (or equivalent) renders the main layout.
Mock `useSession` will be used to simulate authenticated and unauthenticated states.

## Commands you will need

| Purpose      | Command                                       | Expected on success |
|--------------|-----------------------------------------------|---------------------|
| Unit tests   | `npx jest --config jest.component.config.ts tests/components/AppShell.test.tsx` | all pass            |
| Typecheck    | `npx tsc --noEmit`                            | exit 0              |

## Scope

**In scope**:
- `tests/components/AppShell.test.tsx` (CREATE)

**Out of scope**:
- Modifying `src/components/AppShell.tsx`
- Testing other components

## Git workflow

- Branch: `improve/025b-appshell-tests`
- Commit: `test: add component tests for AppShell`
- Do NOT push or open a PR

## Steps

### Step 1: Write `AppShell.test.tsx`

Create `tests/components/AppShell.test.tsx`. Test cases:

1. **Renders the ChickenTrack title** — regardless of auth state, the app title link should always be present.
2. **Shows NavMenu and UserMenu when authenticated** — mock `useSession` to return `{ status: "authenticated", data: { user: { email: "admin@test.com", role: "Admin" } } }`, verify NavMenu and UserMenu render.
3. **Does not show NavMenu or UserMenu when unauthenticated** — mock `{ status: "unauthenticated" }`, verify they're absent.
4. **Renders SystemStatusFooter** — verify the footer element is present.

Use `render(<AppShell><div>test child</div></AppShell>)` and `screen.getByText` / `screen.queryByText` assertions.

**Verify**: `npx jest --config jest.component.config.ts tests/components/AppShell.test.tsx` — all tests pass.

## Done criteria

- [ ] `tests/components/AppShell.test.tsx` created and all tests pass
- [ ] `npx tsc --noEmit` exits 0

## STOP conditions

- If `AppShell` signature changed significantly such that `render` fails.
- If `useSession` mock doesn't correctly trigger UI changes.

## Maintenance notes

- Ensure the `AppShell` test uses the setup utilities from `tests/components/setup.ts`.
