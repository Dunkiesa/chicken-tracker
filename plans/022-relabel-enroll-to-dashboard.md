# Plan 022: Relabel "Enroll" nav button to "Dashboard"

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 15f34e5..HEAD -- src/components/NavMenu.tsx`
> If `src/components/NavMenu.tsx` changed since this plan was written, compare
> the "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `15f34e5`, 2026-07-03

## Why this matters

The admin-only nav link labeled "Enroll" currently points to `"/"` (the analytics dashboard). Plan 020 moved the enrollment form to `/roster` and made `"/"` the dashboard. The label is now misleading — it says "Enroll" but navigates to the dashboard. Renaming it to "Dashboard" matches what the button actually does.

## Current state

- `src/components/NavMenu.tsx` — navigation component shown to authenticated users. At line 36, an admin-only `<a>` link reads "Enroll" but links to `"/"`:

```tsx
// src/components/NavMenu.tsx, lines 24-38
{isAdmin && (
  <a
    href="/"
    style={{
      padding: "0.4rem 0.75rem",
      background: "#f57c00",
      color: "#fff",
      borderRadius: "4px",
      textDecoration: "none",
      fontSize: "0.875rem",
    }}
  >
    Enroll
  </a>
)}
```

Repo conventions: Use inline styles (the codebase does not use a CSS framework or CSS modules for the nav). JSX text is plain — no i18n wrappers.

## Commands you will need

| Purpose   | Command               | Expected on success |
|-----------|-----------------------|---------------------|
| Lint      | `npm run lint`        | exit 0              |
| Build     | `npm run build`       | exit 0              |
| Tests     | `npm test`            | all pass            |

## Scope

**In scope** (the only file to modify):
- `src/components/NavMenu.tsx`

**Out of scope** (do NOT touch):
- Any other occurrence of "enroll" in the codebase — they describe the enrollment *action* (e.g. "Enrolled Chickens" heading, "Failed to enroll chicken" errors) and are correct as-is.

## Git workflow

- Branch: `advisor/022-relabel-enroll-to-dashboard`
- Single commit with message: `rename "Enroll" nav link to "Dashboard"`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Change the button label

In `src/components/NavMenu.tsx`, line 36, replace `Enroll` with `Dashboard`. The `href="/"` stays unchanged.

**Verify**: `findstr /n "Dashboard" src\components\NavMenu.tsx` should show the new label at line 36.

### Step 2: Run verification commands

```powershell
npm run lint
if ($?) { npm run build }
if ($?) { npm test }
```

**Verify**: All three commands exit 0.

## Test plan

No new tests needed. Existing test suite must pass.

## Done criteria

All must hold:

- [ ] `git diff` shows exactly 1 file changed, 1 line changed: `src/components/NavMenu.tsx` — "Enroll" replaced with "Dashboard"
- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] `findstr "Enroll" src\components\NavMenu.tsx` returns no matches
- [ ] `plans/README.md` status row for plan 022 is set to `DONE`

## STOP conditions

Stop and report back (do not improvise) if:

- The "Enroll" text at `src/components/NavMenu.tsx:36` doesn't match the excerpt above (the file has drifted).
- Any verification command fails after a single retry.
- You see any other user-facing "Enroll" text that should also change to "Dashboard" — the plan scope is intentionally limited to the nav button. Other "enroll" references describe the *action* and are correct.

## Maintenance notes

- Plan 019 originally added the "Enroll" link. Its label drifted when plan 020 changed what `"/"` means. If the nav gets another reorg, check that all link labels match their targets.
- All other "enroll" text (headings, error messages) is correct and should stay as-is.
