# Plan 023: Remove redundant sign-in button from AppShell header

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9f05e7b..HEAD -- src/components/AppShell.tsx src/app/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `9f05e7b`, 2026-07-03

## Why this matters

The AppShell header renders a "Sign in with Google" button for unauthenticated users (`src/components/AppShell.tsx:34-48`), and the home page's splash section also renders an identical button (`src/app/page.tsx:175-189`). Since every page is wrapped by AppShell, unauthenticated visitors to `/` see two sign-in buttons stacked vertically. This is visually confusing and implies two separate auth actions.

## Current state

`src/components/AppShell.tsx:33-49` — The header conditionally renders a sign-in button when unauthenticated:

```tsx
{status === "unauthenticated" && (
  <button
    onClick={() => signIn("google")}
    style={{
      padding: "0.4rem 0.75rem",
      background: "#4285f4",
      color: "#fff",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      fontSize: "0.875rem",
    }}
  >
    Sign in with Google
  </button>
)}
```

`src/app/page.tsx:157-192` — The home page's splash section renders its own sign-in button as the primary call-to-action, centered in the page body.

Other authenticated pages (roster, admin, chicken profile) either redirect to `/` or call `signIn("google")` when unauthenticated, so the header sign-in button on those pages would flash briefly before navigation fires.

The repo convention is inline styles throughout — match this style.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build     | `npm run build`          | exit 0              |
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Lint      | `npm run lint`           | exit 0              |

## Scope

**In scope**:
- `src/components/AppShell.tsx` — remove the unauthenticated sign-in button

**Out of scope**:
- The splash sign-in button on `src/app/page.tsx` — keep it
- Any other component or page
- Adding tests (handled in Plan 025)

## Git workflow

- Branch: `improve/023-fix-duplicate-sign-in-buttons`
- Commit: `fix: remove redundant sign-in button from AppShell header`
- Do NOT push or open a PR

## Steps

### Step 1: Remove the unauthenticated sign-in button from AppShell

In `src/components/AppShell.tsx`, remove the `{status === "unauthenticated" && (...)}` block (lines 34-49). Only the authenticated nav menu and user menu should remain.

After the change, the header should look like:

```tsx
<header
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.75rem 1.5rem",
    background: "#fff",
    borderBottom: "1px solid #e0e0e0",
  }}
>
  <a
    href="/"
    style={{
      fontSize: "1.25rem",
      fontWeight: 700,
      color: "#333",
      textDecoration: "none",
    }}
  >
    ChickenTrack
  </a>
  {status === "authenticated" && <NavMenu />}
  {status === "authenticated" && <UserMenu />}
</header>
```

**Verify**: `npm run build` exits 0. The home page no longer shows two sign-in buttons.

### Step 2: Verify all pages still handle unauthenticated state

Each page already handles the unauthenticated case:
- `src/app/page.tsx:157-192` — shows the splash with sign-in button
- `src/app/roster/page.tsx:201-204` — redirects to `/` via `router.push("/")`
- `src/app/admin/page.tsx:73-74` — calls `signIn("google")`
- `src/app/chickens/[id]/page.tsx:124-126` — redirects to `/` via `router.push("/")`
- `src/app/log-egg/page.tsx:75-77` — redirects to `/` via `router.push("/")`

No changes needed to any page — the removal of the header button only affects whether a redundant button appears. Each page's own guard still fires.

**Verify**: Read each listed page and confirm the auth guard is present.

## Test plan

No new tests for this change. The splash screen renders correctly (manual or existing tests) with exactly one sign-in button.

## Done criteria

- [ ] `npm run build` exits 0
- [ ] `npx tsc --noEmit` exits 0
- [ ] No "Sign in with Google" button in AppShell header in the source
- [ ] The home page splash still has its sign-in button
- [ ] No files outside `src/components/AppShell.tsx` are modified

## STOP conditions

- If the AppShell structure differs significantly from the excerpts, stop and report.
- If a page relies on the AppShell header sign-in button as its only auth entry point (none currently do, but verify).

## Maintenance notes

- If a new page is added that does NOT redirect unauthenticated users and has no inline splash, consider whether a header sign-in button is needed — but most pages should redirect to `/` where the splash lives.
- The home page splash is the canonical sign-in experience; keep it as the single entry point.
