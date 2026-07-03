# Plan 026: Standardize auth guard pattern across authenticated pages

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9f05e7b..HEAD -- src/app/roster/page.tsx src/app/chickens/\[id\]/page.tsx src/app/admin/page.tsx src/app/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 025 (component tests provide safety net)
- **Category**: tech-debt
- **Planned at**: commit `9f05e7b`, 2026-07-03

## Why this matters

Four different auth-guard patterns exist across the app's pages, creating inconsistent user experience and making it harder to reason about auth behavior:

1. Home page (`page.tsx`): conditional render of splash vs dashboard
2. Roster page: `router.push("/")` which pollutes browser history
3. Admin page: calls `signIn("google")` directly, skipping the splash entirely
4. Chicken profile: `router.push("/")`

Standardizing on `router.replace("/")` everywhere ensures unauthenticated users always end up at the splash page with a clean history stack.

## Current state

**`src/app/roster/page.tsx:200-204`** — Uses `router.push`:
```tsx
useEffect(() => {
  if (status === "unauthenticated") {
    router.push("/");
  }
}, [status, router]);
```

**`src/app/chickens/[id]/page.tsx:124-127`** — Uses `router.push`:
```tsx
if (status === "unauthenticated") {
  router.push("/");
  return;
}
```

**`src/app/admin/page.tsx:73-75`** — Calls `signIn("google")`:
```tsx
if (status === "unauthenticated") {
  signIn("google");
  return;
}
```

**`src/app/page.tsx:157-192`** — Conditional render (correct pattern — splash is on this page):
```tsx
if (status === "unauthenticated") {
  return <div>... splash with sign-in button ...</div>;
}
```

**`src/app/log-egg/page.tsx:75-77`** — Uses `router.push`:
```tsx
if (status === "unauthenticated") {
  router.push("/");
  return;
}
```

All pages follow the inline-style convention — no changes to styling needed.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build     | `npm run build`          | exit 0              |
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Component tests | `npx jest --config jest.component.config.ts` | all pass |

## Scope

**In scope**:
- `src/app/roster/page.tsx` — `router.push` → `router.replace`
- `src/app/chickens/[id]/page.tsx` — `router.push` → `router.replace`
- `src/app/admin/page.tsx` — `signIn("google")` → `router.replace("/")`
- `src/app/log-egg/page.tsx` — `router.push` → `router.replace`

**Out of scope**:
- `src/app/page.tsx` — its conditional render is the correct pattern (it IS the splash)
- Any other page, component, or test file
- Removing `signIn` import from admin page (might still be used elsewhere? Check — it's only used in the guard at `admin/page.tsx:74`)

## Git workflow

- Branch: `improve/026-standardize-auth-guard`
- Commits: one per page or one bulk commit
- Message: `refactor: standardize auth guard to router.replace("/") across all pages`
- Do NOT push or open a PR

## Steps

### Step 1: Fix roster page guard

In `src/app/roster/page.tsx:201`, change `router.push("/")` to `router.replace("/")`.

**Verify**: `npm run build` exits 0. The page redirects to `/` without adding to history.

### Step 2: Fix chicken profile page guard

In `src/app/chickens/[id]/page.tsx:125`, change `router.push("/")` to `router.replace("/")`.

**Verify**: `npm run build` exits 0.

### Step 3: Fix log-egg page guard

In `src/app/log-egg/page.tsx:76`, change `router.push("/")` to `router.replace("/")`.

**Verify**: `npm run build` exits 0.

### Step 4: Fix admin page guard

In `src/app/admin/page.tsx:74`, change `signIn("google")` to `router.replace("/")`.

Also verify that `signIn` is no longer imported at the top of the file (line 3) — if it was only used for this guard, remove it from the import:

```tsx
// Before:
import { useSession, signIn } from "next-auth/react";

// After:
import { useSession } from "next-auth/react";
```

**Verify**: `npm run build` exits 0. `grep "signIn" src/app/admin/page.tsx` returns no matches.

### Step 5: Run component tests

**Verify**: `npx jest --config jest.component.config.ts` exits 0 (Plan 025's tests should still pass — the guard changes don't affect the component interfaces, only the redirect behavior).

## Test plan

Each page's behavior change:
- Roster, chicken profile, log-egg: `router.push` → `router.replace` — no functional change visible to the user, only history stack behavior
- Admin: no longer calls `signIn("google")` directly — unauthenticated users see the splash page instead of being forcibly redirected to Google. This is more consistent with other pages.

The existing component tests (Plan 025) cover the RosterPage's unauthenticated guard path — verify they still pass.

## Done criteria

- [ ] `npm run build` exits 0
- [ ] `npx tsc --noEmit` exits 0
- [ ] All four pages use `router.replace("/")` for unauthenticated guards
- [ ] `grep "signIn" src/app/admin/page.tsx` returns no matches (import removed)
- [ ] Component tests pass: `npx jest --config jest.component.config.ts` exits 0

## STOP conditions

- If any page has been rewritten to not use `useSession` / `useRouter`, stop and report.
- If `signIn` is used elsewhere in `admin/page.tsx` (beyond the guard), keep the import and only replace the guard call.
- If a page's auth guard has been removed entirely (not guarded by status check), stop — the page may rely on AppShell or middleware for auth which doesn't exist yet.

## Maintenance notes

- Future pages should use `router.replace("/")` for unauthenticated guards, not `router.push`, `signIn()`, or conditional render (unless the page IS the splash).
- The home page is intentionally exempt — it shows the splash inline.
- If Next.js middleware is added for route-level auth, all these per-page guards can be removed in a future refactor.
