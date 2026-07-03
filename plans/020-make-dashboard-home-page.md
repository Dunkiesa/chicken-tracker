# Plan 020: Make the Analytics Dashboard the home page

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e5b44a3..HEAD -- src/app/page.tsx src/app/dashboard/page.tsx src/components/NavMenu.tsx`
> If any of these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/019-enroll-in-nav-and-rename-log.md (note: 019 and 020 both modify `NavMenu.tsx` — see Dependency notes in `plans/README.md`)
- **Category**: direction
- **Planned at**: commit `e5b44a3`, 2026-07-03
- **Issue**: (omit unless published via `--issues`)

## Why this matters

Currently the home page at `/` shows the chicken roster + enrollment form, and the analytics dashboard lives at a separate `/dashboard` route. Users land on the roster every time they open the app. Making the dashboard the home page means users see production analytics (egg counts, trends, dry period alerts) immediately on arrival — the most actionable view for a flock manager. The roster moves to `/roster`, accessed from the nav when needed.

## Current state

**Files involved:**

- `src/app/page.tsx` (726 lines) — home page. Shows a splash screen for unauthenticated users (lines 208–244) and the chicken roster + admin enrollment form for authenticated users (lines 246–725). Contains all state/handlers for fetching chickens, enrolling, marking departed, and reinstating.

- `src/app/dashboard/page.tsx` (683 lines) — analytics dashboard. Renders summary cards, production time series (daily/weekly/monthly), average egg weight, weight variance, most productive chickens, consistency rates, dry period alerts, seasonal trends, and attrition. Redirects unauthenticated users to `/` (line 140). Only internal link to `/dashboard` is in NavMenu.tsx.

- `src/components/NavMenu.tsx` (54 lines) — navigation bar. Links: "Bulk Log" → `/log-egg`, "Dashboard" → `/dashboard` (purple, `#6a1b9a`), "Admin" → `/admin` (admin-only, blue `#1565c0`).

- `src/app/roster/page.tsx` — does not exist yet. Will be created.

### Repo conventions to follow

- All pages use `"use client"` with `import { useSession } from "next-auth/react"`.
- Unauthenticated redirects use `useRouter` from `next/navigation` and `router.push("/")`.
- Inline `style` props for all styling — no CSS modules or Tailwind.
- NavMenu link pattern: `padding: "0.4rem 0.75rem"`, `borderRadius: "4px"`, `textDecoration: "none"`, `fontSize: "0.875rem"`, white text on colored background.
- Domain vocabulary from `CONTEXT.md`: chickens, roster, enrollment, dashboard, analytics.
- Data-fetching pattern: `useState` + `useCallback` wrappers + `useEffect` to trigger on mount, matching `src/app/dashboard/page.tsx:119-146`.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Lint      | `npm run lint`           | exit 0, no errors   |
| Build     | `npm run build`          | exit 0, no errors   |
| Tests     | `npm test`               | all pass            |
| Integration tests | `npm run test:integration` | all pass    |

## Scope

**In scope** (the only files you should modify or create):
- `src/app/page.tsx` — replace authenticated content with dashboard content
- `src/app/roster/page.tsx` — **create**; move roster + enrollment content here
- `src/components/NavMenu.tsx` — replace Dashboard link with Roster link
- `src/app/dashboard/page.tsx` — replace content with a redirect to `/`

**Out of scope** (do NOT touch):
- `src/app/log-egg/page.tsx`, `src/app/admin/page.tsx`, `src/app/chickens/[id]/page.tsx` — other pages, unchanged
- `src/components/AppShell.tsx` — the logo link to `/` is fine; it now goes to the dashboard
- `src/app/layout.tsx` — no layout changes
- Any test files — the existing integration tests call library functions directly, not HTTP routes; they don't depend on page routing
- The splash screen behavior for unauthenticated users — stays on `/`

## Git workflow

- Branch: `advisor/020-make-dashboard-home-page`
- Commit per step (4 commits); message style: conventional commits — `feat: move dashboard to home page`, `feat: create roster page for chicken management`, `refactor: update nav menu links`, `refactor: redirect old dashboard route`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create roster page at `src/app/roster/page.tsx`

Create the directory `src/app/roster/` and file `page.tsx`. This file receives the roster + enrollment content from the current `src/app/page.tsx`.

The new file must contain:

1. `"use client"` directive
2. Imports: `{ useEffect, useState, useCallback }` from `"react"`, `{ useSession }` from `"next-auth/react"`, `{ useRouter }` from `"next/navigation"`
3. All type definitions (`Chicken`, `DynamicListEntry`) — copy from `src/app/page.tsx:6-23`
4. Constants: `SEX_OPTIONS`, `DEPARTURE_REASONS` — copy from `src/app/page.tsx:25-28`
5. Helper function `todayStr()` — copy from `src/app/page.tsx:29-35`
6. Component: copy the entire `Home` function from `src/app/page.tsx:37-725` with these changes:
   - Rename the export from `Home` to `RosterPage`
   - Add `const router = useRouter();` after the `useSession()` call
   - Replace the unauthenticated return block (currently lines 208–244 in page.tsx, which shows a splash screen) with a redirect: when `status === "unauthenticated"`, use `useEffect` + `router.push("/")` to redirect to the home page (now the dashboard). Use the same pattern as `src/app/dashboard/page.tsx:138-141`:

```tsx
useEffect(() => {
  if (status === "unauthenticated") {
    router.push("/");
  }
}, [status, router]);
```

   - Keep the loading return (currently `page.tsx:198-207`) as is
   - Keep the entire authenticated return (the main div with enrollment form + roster table) as-is from `page.tsx:246-725`

**Verify**: `npm run lint` → exit 0, no errors.

### Step 2: Replace home page content with dashboard

Modify `src/app/page.tsx` to show the analytics dashboard content (from `src/app/dashboard/page.tsx`) instead of the roster, but keep the existing splash screen logic for unauthenticated users.

Specifically:

1. Replace all the type definitions (`Chicken`, `DynamicListEntry`, `SEX_OPTIONS`, `DEPARTURE_REASONS`, etc.) with the analytics types from `src/app/dashboard/page.tsx:7-88`. Import `{ useRouter }` from `"next/navigation"` as well (the dashboard page uses it).

2. Replace the component body (everything after `export default function Home()`) with a merge of:
   - The loading return from current `page.tsx:198-207` (keep as-is)
   - The unauthenticated splash from current `page.tsx:208-244` (keep as-is)
   - The authenticated content: replace the roster div with the entire dashboard rendering from `src/app/dashboard/page.tsx:148-681`, adapted as follows:

     a. Import the return as the authenticated branch — replace everything from the current `return (` at `page.tsx:246` to the final `}` at `page.tsx:725` with the dashboard's rendering.

     b. Copy the `fetchAnalytics`, `handleRefresh`, state variables, and other logic from `dashboard/page.tsx:109-150` into the Home component.

     c. DO NOT copy the `router.push("/")` redirect for unauthenticated users from `dashboard/page.tsx:138-141` — the home page already handles unauthenticated state with the splash screen. Instead, the `useEffect` for authenticated should only trigger `fetchAnalytics`:

```tsx
useEffect(() => {
  if (status === "authenticated") {
    fetchAnalytics(dateFrom, dateTo);
  }
}, [status, fetchAnalytics, dateFrom, dateTo]);
```

     d. Keep the dashboard's `sectionStyle` constant.

3. Remove the `todayStr()` helper from the home page (keep only the `todayStr()` and `oneYearAgoStr()` from the dashboard content — the roster has its own copy).

**Verify**: `npm run lint` → exit 0, no errors. `npm run build` → exit 0.

### Step 3: Update navigation menu

Modify `src/components/NavMenu.tsx` to replace the "Dashboard" link with a "Roster" link pointing to `/roster`, using color `#00897b` (teal).

Find the existing Dashboard link (lines 24–36 in the current file):

```tsx
      <a
        href="/dashboard"
        style={{
          padding: "0.4rem 0.75rem",
          background: "#6a1b9a",
          color: "#fff",
          borderRadius: "4px",
          textDecoration: "none",
          fontSize: "0.875rem",
        }}
      >
        Dashboard
      </a>
```

Replace `href="/dashboard"` with `href="/roster"`, change `background: "#6a1b9a"` to `background: "#00897b"`, and change the text `Dashboard` to `Roster`.

**Verify**: `npm run lint` → exit 0, no errors.

### Step 4: Redirect old dashboard route

Replace the content of `src/app/dashboard/page.tsx` with a simple client-side redirect. The entire file becomes:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <main style={{ padding: "2rem", textAlign: "center", color: "#999" }}>
      Redirecting to dashboard…
    </main>
  );
}
```

This preserves any bookmarks pointing to `/dashboard`.

**Verify**: `npm run lint` → exit 0, no errors. `npm run build` → exit 0.

### Step 5: Full verification

Run all verifications together:

```
npm run lint
npm run build
npm test
npm run test:integration
```

All must exit 0 and all tests must pass (82+ integration tests). The build verifies the new/edited pages compile without import or type errors.

## Test plan

No new tests needed. The existing integration tests call domain library functions (`getAnalytics`, `listChickens`, etc.) directly — they don't depend on which route renders which page. The test suite should pass unchanged.

Manually verify after starting `npm run dev`:
- Unauthenticated user visits `/` → sees splash screen (unchanged)
- Authenticated user visits `/` → sees analytics dashboard with summary cards and data tables
- Authenticated user visits `/roster` → sees the chicken roster with enrollment form (admin)
- NavMenu shows "Log", "Roster" instead of "Dashboard"
- `/dashboard` redirects to `/`

## Done criteria

- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] `npm run test:integration` exits 0
- [ ] `src/app/roster/page.tsx` exists and contains the roster + enrollment content
- [ ] `src/app/page.tsx` renders dashboard content in the authenticated branch, splash in the unauthenticated branch
- [ ] `grep -rn 'href="/dashboard"' src/components/NavMenu.tsx` returns no matches
- [ ] `src/app/dashboard/page.tsx` contains a redirect to `/` (not the old 683-line component)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `src/app/page.tsx` or `src/app/dashboard/page.tsx` doesn't match the "Current state" excerpts (codebase has drifted).
- A verification step fails twice after a reasonable fix attempt.
- The plan would require modifying a file marked as out of scope.
- The build fails with type errors that can't be resolved by straightforward import path fixes.
- The integration tests fail (they connect to a real SQL Server — if no DB is available, note this and move on to the other verifications).

## Maintenance notes

- The `/dashboard` route still exists as a redirect. If the route is confirmed unused in the future, the file can be deleted entirely.
- The roster page at `/roster` shares types and logic with the chicken profile page at `src/app/chickens/[id]/page.tsx`. If chicken types change, update both files.
- The home page now contains all the analytics types and dashboard logic (~680 lines). If this becomes unwieldy, consider extracting the dashboard into a component at `src/components/Dashboard.tsx`.
- Plan 019 also modifies `NavMenu.tsx` (renames "Bulk Log" → "Log", adds "Enroll" button). If both plans are being executed, execute 019 first, then 020 — 020 will change the Dashboard link to Roster on top of 019's changes. If only 020 is executed, the NavMenu will have "Bulk Log", "Roster", "Admin" (no "Enroll" button, no "Log" rename).
