# Plan 019: Add Enroll button to navigation menu and rename Bulk Log to Log

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e5b44a3..HEAD -- src/components/NavMenu.tsx`
> If `NavMenu.tsx` changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `e5b44a3`, 2026-07-03
- **Issue**: (omit unless published via `--issues`)

## Why this matters

The navigation menu currently lacks a direct way to reach the chicken enrollment (Add Chicken) form — it's only accessible at the home page `/`. Adding an "Enroll" link gives admins quick access from anywhere. Also, "Bulk Log" is a legacy name from when there was a single-egg "Quick Log" feature; renaming it to "Log" keeps the UI concise.

## Current state

- `src/components/NavMenu.tsx:4-53` — The navigation component. Renders conditional links based on session role. Currently has: "Bulk Log" (always), "Dashboard" (always), "Admin" (admin-only). The enrollment form lives on the home page at `/` and is rendered inside an `isAdmin` check in `src/app/page.tsx:273-406`.

Current "Bulk Log" link (lines 10-23):
```tsx
<a
  href="/log-egg"
  style={{
    padding: "0.4rem 0.75rem",
    background: "#2e7d32",
    color: "#fff",
    borderRadius: "4px",
    textDecoration: "none",
    fontSize: "0.875rem",
    fontWeight: 600,
  }}
>
  Bulk Log
</a>
```

Admin links condition (lines 37-51):
```tsx
{isAdmin && (
  <a
    href="/admin"
    ...
  >
    Admin
  </a>
)}
```

### Repo conventions to follow

- All styling is done via inline `style` props — no CSS modules, no Tailwind.
- NavMenu link style pattern: `padding: "0.4rem 0.75rem"`, `borderRadius: "4px"`, `textDecoration: "none"`, `fontSize: "0.875rem"`, white text on a colored background. Each nav link uses a distinct background color.
- The Bulk Log link uses `#2e7d32` (green) with `fontWeight: 600`. Other links match this pattern without the bold weight.
- Conditional rendering for admin-only items follows the `{isAdmin && (...)}` pattern as shown above.
- The NavMenu uses `"use client"` and imports `useSession` from `next-auth/react`.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Lint      | `npm run lint`           | exit 0, no errors   |
| Build     | `npm run build`          | exit 0, no errors   |

There is no existing NavMenu test. No tests to run for this change.

## Scope

**In scope** (the only files you should modify):
- `src/components/NavMenu.tsx`

**Out of scope** (do NOT touch, even though they look related):
- `src/app/page.tsx` — the enrollment form itself; not changing its placement or behavior
- Any other navigation or layout files
- No test files needed for this UI-only change

## Git workflow

- Branch: `advisor/019-enroll-in-nav-and-rename-log`
- Commit per step (2 commits); message style: conventional commits, matching repo style — e.g. `feat: add Enroll button to nav menu`, `refactor: rename Bulk Log to Log in nav`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Rename "Bulk Log" to "Log" in NavMenu

Locate the text `Bulk Log` in `src/components/NavMenu.tsx` and change it to `Log`.

The link currently reads:
```tsx
  >
    Bulk Log
  </a>
```

Change `Bulk Log` to `Log`.

**Verify**: Run `npm run lint` → exit 0 with no errors.

### Step 2: Add Enroll navigation link (admin-only)

Add a new "Enroll" link in `src/components/NavMenu.tsx` between the "Log" link and the "Dashboard" link. It must be wrapped in an `isAdmin` check (same pattern as the Admin link). Use background color `#f57c00` (orange) to distinguish it.

The link should point to `"/"` (the home page, where the enrollment form lives). Do NOT make it bold (match the Dashboard/Admin pattern, not the Log link).

Insert a new admin-only link between lines 23 and 24 (after the Log link closes, before the Dashboard link opens), following this exact shape:

```tsx
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

**Verify**: `npm run lint` → exit 0. Verify the nav renders correctly: `npm run build` → exit 0.

## Test plan

No tests needed. This is a UI-only change to the navigation component. The repo has no component-level tests for NavMenu.

To manually verify after starting the dev server (`npm run dev`):
- As an Admin user: the nav should show "Log", "Enroll", "Dashboard", "Admin". Click "Enroll" → navigates to `/` (home page).
- As a Viewer user: the nav should show "Log", "Dashboard". "Enroll" and "Admin" should be hidden.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] `grep -rn "Bulk Log" src/components/NavMenu.tsx` returns no matches (text has been renamed)
- [ ] `grep -rn "Enroll" src/components/NavMenu.tsx` returns exactly 2 matches (the link text and a false match isn't an issue — just confirm the link is present)
- [ ] No files outside `src/components/NavMenu.tsx` are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `src/components/NavMenu.tsx` doesn't match the "Current state" excerpts (the codebase has drifted since this plan was written).
- `npm run lint` fails after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- The "Enroll" link points to `/` (home page). If the enrollment form is ever moved to a dedicated route (e.g., `/enroll`), update this link accordingly.
- If the NavMenu style conventions change (e.g., adoption of a CSS framework), this link should be refactored to match the new pattern.
- The "Log" name is now shorter; ensure no other UI references to "Bulk Log" remain elsewhere in the codebase (search with `git grep "Bulk Log"` to confirm).
