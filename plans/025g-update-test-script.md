# Plan 025g: Update test script

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
- **Effort**: S (Shared with 025)
- **Risk**: LOW
- **Depends on**: 025a
- **Category**: tests
- **Planned at**: commit `9f05e7b`, 2026-07-03

## Why this matters

Providing a standard `npm run test:components` command makes it easier for developers to run the newly added component tests without needing to remember the full Jest configuration command.

## Current state

`package.json` does not have a dedicated script for component tests.

## Commands you will need

| Purpose      | Command                  | Expected on success |
|--------------|--------------------------|---------------------|
| Build        | `npm run build`          | exit 0              |
| Run tests    | `npm run test:components`| all pass            |

## Scope

**In scope**:
- `package.json` (UPDATE)

**Out of scope**:
- Modifying any other files

## Git workflow

- Branch: `improve/025g-update-test-script`
- Commit: `test: add test:components script to package.json`
- Do NOT push or open a PR

## Steps

### Step 1: Add `test:components` script to `package.json`

Add the following script to the `scripts` section of `package.json`:

```json
"test:components": "jest --config jest.component.config.ts"
```

**Verify**: `npm run test:components` runs all component tests and exits 0.

## Done criteria

- [ ] `test:components` script added to `package.json`
- [ ] `npm run test:components` successfully runs all component tests

## STOP conditions

- If `npm run test:components` fails for any reason other than a failing test.

## Maintenance notes

- This script is intended specifically for component tests using `jsdom`. The default `npm test` remains for integration tests using `node`.
