# Plan 018: Add splash screen for unauthenticated users on the homepage

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e0d0280..HEAD -- src/app/page.tsx src/components/AppShell.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/017-shared-app-shell.md
- **Category**: direction
- **Planned at**: commit `e0d0280`, 2026-07-03
- **Issue**: (none)

## Why this matters

Currently, the homepage (`/`) loads the full chicken management UI — enrollment form, chicken table, system status — even before the user has signed in. The sign-in button is just one element in a cluttered header. A visitor who opens the app sees a table full of chicken data they can't interact with. A dedicated splash screen (branded landing with logo/title, tagline, and prominent sign-in button) makes the app feel polished for first-time or infrequent users, and clearly separates "not signed in" from "signed in" states.

## Current state

After Plan 017 lands, the homepage (`src/app/page.tsx`) no longer has inline header/nav/user elements or the system-status section. It starts directly with the "Enrolled Chickens" heading and the chicken management UI.

The auth-state branching already exists in the page:

```tsx
// src/app/page.tsx:44-46 (current)
export default function Home() {
  const { data: session, status } = useSession();
  // ...
```

And the page already conditionally renders content based on auth status (lines 408-553), such as hiding the enrollment form from non-admins and showing "Sign in to manage chickens" when not logged in. But it still renders the full page structure (headings, tables, etc.) regardless.

The `AppShell` (Plan 017) already shows a "Sign in with Google" button in the header when `status === "unauthenticated"`, but the main page content still loads underneath.

**Conventions**: All inline styles, `"use client"` directives, Next.js 14 App Router. The project brand name is "ChickenTrack" with tagline "Egg-production tracking for your backyard flock" (from `page.tsx:337-339` and layout metadata).

## Commands you will need

| Purpose   | Command               | Expected on success |
|-----------|-----------------------|---------------------|
| Build     | `npm run build`       | exit 0, no errors   |
| Lint      | `npm run lint`        | exit 0              |
| Test      | `npm run test`        | all pass            |
| Integration | `npm run test:integration` | all pass        |

## Scope

**In scope** (the only files you should modify):
- `src/app/page.tsx` — add splash screen rendering when unauthenticated

**Out of scope** (do NOT touch):
- `src/components/` — no new components needed; reuse AppShell's sign-in button pattern
- `src/app/log-egg/page.tsx` — already redirects to `/` when unauthenticated (line 75-78)
- `src/app/dashboard/page.tsx` — same, already redirects
- `src/app/admin/page.tsx` — same, already redirects
- `src/app/chickens/[id]/page.tsx` — same, already redirects
- `src/app/layout.tsx` — no changes
- `src/app/providers.tsx` — no changes
- Any test files
- Any API routes

## Git workflow

- Branch: `improve/018-splash-screen`
- Use a worktree: `git worktree add ../chicken-018 improve/018-splash-screen`
- Work in the worktree directory `../chicken-018/`
- Commit per logical step; message style: `feat: add splash screen for unauthenticated users`

## Steps

### Step 1: Confirm Plan 017 has landed

Check that `src/components/AppShell.tsx` exists and the AppShell header already renders the "Sign in with Google" button. Also confirm the homepage has had its header and system-status sections removed.

If Plan 017 has NOT landed yet, STOP and report: this plan depends on it.

**Verify**: `ls src/components/AppShell.tsx` and `grep -n "Sign in with Google" src/components/AppShell.tsx` return a match.

### Step 2: Add early-return splash in the homepage

Modify `src/app/page.tsx` so that when `status === "unauthenticated"`, the component renders ONLY a splash screen and returns early — the chicken management UI is never rendered.

The splash screen should:
1. Be a centered, full-height flex column occupying the `<main>` area.
2. Show the app name "ChickenTrack" as a large heading (2.5rem, bold).
3. Show the tagline "Egg-production tracking for your backyard flock".
4. Show the "Sign in with Google" button (matching the existing style from `page.tsx:245-256`).
5. NOT include any chicken data, tables, forms, or management UI.

```tsx
// Add near the top of the Home component, after the isAdmin variable and before the return:

if (status === "loading") {
  return (
    <div style={{
      display: "flex", justifyContent: "center", alignItems: "center",
      minHeight: "60vh", color: "#999", fontSize: "1rem",
    }}>
      Loading...
    </div>
  );
}

if (status === "unauthenticated") {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      padding: "2rem",
      textAlign: "center",
      gap: "1.5rem",
    }}>
      <h1 style={{ fontSize: "2.5rem", fontWeight: 700, color: "#333" }}>
        ChickenTrack
      </h1>
      <p style={{ color: "#666", fontSize: "1.1rem", maxWidth: "400px" }}>
        Egg-production tracking for your backyard flock
      </p>
      <button
        onClick={() => signIn("google")}
        style={{
          padding: "0.6rem 1.5rem",
          background: "#4285f4",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "1rem",
          fontWeight: 600,
        }}
      >
        Sign in with Google
      </button>
    </div>
  );
}
```

Add these checks right before the existing `return` statement. Since the component has early returns for loading and unauthenticated, the main chicken management JSX only runs when authenticated.

Note: The "Sign in with Google" button in the splash screen is the primary login action. The AppShell header also has one — that's fine, having it in both places means the user can sign in from anywhere on the page.

**Verify**: `npm run build` exits 0.

### Step 3: Verify the splash screen behavior

1. Start the dev server: `npm run dev`
2. Open the app in an incognito/private browser window (no active session).
3. Confirm you see ONLY: "ChickenTrack" heading, the tagline, and "Sign in with Google" button. No chicken data, no tables, no enrollment form.
4. Click "Sign in with Google" — authenticate. After redirect, confirm you see the chicken management UI.

**Verify**: The above manual checks pass.

### Step 4: Final verification

```bash
npm run build  # exit 0
npm run lint   # exit 0
npm run test   # all pass
npm run test:integration  # all pass
```

**Verify**: All commands exit 0, all tests pass.

## Test plan

No new tests needed for this change. The existing integration tests in `tests/` don't test the homepage splash behavior (they test API endpoints). If any test checks for specific page content that conflicts with the splash screen, update the test.

## Done criteria

- [ ] `npm run build` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test` exits 0
- [ ] `npm run test:integration` exits 0
- [ ] When `status === "unauthenticated"`, the homepage shows only the splash screen (title + tagline + sign-in button)
- [ ] When authenticated, the homepage shows the full chicken management UI
- [ ] No chicken data (table, enrollment form) is rendered in the DOM when unauthenticated
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `src/components/AppShell.tsx` does not exist (Plan 017 has not landed — this plan depends on it).
- The code at `src/app/page.tsx` doesn't match the described structure after Plan 017 (the header/nav/user/status sections are still present).
- A build or test step fails twice after a reasonable fix attempt.

## Maintenance notes

- The splash screen uses the same `signIn("google")` call as the rest of the app. If the auth provider changes (e.g., adding email/password), update the button handler here.
- The splash screen does NOT show the system status footer (that's in AppShell). This is intentional — unauthenticated visitors don't need to know DB connection status.
- If the app brand name or tagline changes, update them in two places: the layout metadata (`src/app/layout.tsx`) and this splash screen.
