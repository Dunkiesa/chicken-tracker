# Plan 027: Fix roster page auth guard to use `router.replace`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9f05e7b..HEAD -- src/app/roster/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `9f05e7b`, 2026-07-03

## Why this matters

The roster page uses `router.push("/")` for its unauthenticated guard, which adds a redirect URL entry to the browser history. After being redirected, pressing the browser back button briefly shows the roster page before the guard fires again, creating a redirect loop in history. Using `router.replace("/")` avoids this by replacing the current history entry.

## Current state

`src/app/roster/page.tsx:200-204`:

```tsx
useEffect(() => {
  if (status === "unauthenticated") {
    router.push("/");
  }
}, [status, router]);
```

`router` is imported from `next/navigation` at line 5:

```tsx
import { useRouter } from "next/navigation";
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope**:
- `src/app/roster/page.tsx` — one character change

**Out of scope**:
- Any other page's auth guard (handled in Plan 026)
- Any other file

## Git workflow

- Branch: `improve/027-fix-router-replace-roster`
- Commit: `fix: use router.replace in roster auth guard to avoid back-button loop`
- Do NOT push or open a PR

## Steps

### Step 1: Change `push` to `replace`

In `src/app/roster/page.tsx`, line 201, change:

```tsx
router.push("/");
```

to:

```tsx
router.replace("/");
```

**Verify**: `npm run build` exits 0. The guard still redirects unauthenticated users to `/` but no longer pollutes browser history.

## Test plan

Tested manually: sign out, navigate to `/roster`, observe redirect to splash page. Pressing back shows the previous page (not a flash of the roster page).

## Done criteria

- [ ] `npm run build` exits 0
- [ ] `grep "router.push" src/app/roster/page.tsx` returns no matches
- [ ] `grep "router.replace" src/app/roster/page.tsx` returns at least one match

## STOP conditions

- If the roster page's guard has been removed or rewritten, stop and report.
- If `router` is no longer used on the page after the change, also remove the `useRouter` import.

## Maintenance notes

- This change is a subset of Plan 026 (standardize all auth guards). If 026 is already applied, this plan is a no-op. Check 026's status in `plans/README.md` before starting.
