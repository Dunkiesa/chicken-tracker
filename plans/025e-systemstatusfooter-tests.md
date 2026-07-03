# Plan 025e: Write SystemStatusFooter tests

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

The `SystemStatusFooter` informs users about the health of the system. Correct display of loading, healthy, and error states is crucial for transparency.

## Current state

`src/components/SystemStatusFooter.tsx` fetches health data from an API.

## Commands you will need

| Purpose      | Command                                       | Expected on success |
|--------------|-----------------------------------------------|---------------------|
| Unit tests   | `npx jest --config jest.component.config.ts tests/components/SystemStatusFooter.test.tsx` | all pass            |
| Typecheck    | `npx tsc --noEmit`                            | exit 0              |

## Scope

**In scope**:
- `tests/components/SystemStatusFooter.test.tsx` (CREATE)

**Out of scope**:
- Modifying `src/components/SystemStatusFooter.tsx`

## Git workflow

- Branch: `improve/025e-systemstatusfooter-tests`
- Commit: `test: add component tests for SystemStatusFooter`
- Do NOT push or open a PR

## Steps

### Step 1: Write `SystemStatusFooter.test.tsx`

Create `tests/components/SystemStatusFooter.test.tsx`. Test cases:

1. **Does not render when unauthenticated** — mock `status: "unauthenticated"`, verify `container.firstChild` is null.
2. **Shows checking state when authenticated but health not yet loaded** — mock `status: "authenticated"`, mock `fetch` to return a pending promise, verify "Checking system health..." text.
3. **Shows healthy state on successful fetch** — mock `fetch` to resolve with `{ status: "ok", database: "connected", timestamp: "2026-07-03T00:00:00Z" }`, verify "Healthy" and "Connected" text.
4. **Shows error state on fetch failure** — mock `fetch` to reject, verify "API unavailable" text.

**Verify**: `npx jest --config jest.component.config.ts tests/components/SystemStatusFooter.test.tsx` — all tests pass.

## Done criteria

- [ ] `tests/components/SystemStatusFooter.test.tsx` created and all tests pass
- [ ] `npx tsc --noEmit` exits 0

## STOP conditions

- If `SystemStatusFooter` uses a different mechanism for fetching (e.g., React Query) instead of raw `fetch`.
- If the health status object shape changes significantly.

## Maintenance notes

- Ensure the `SystemStatusFooter` test correctly mocks the fetch calls for different states.
