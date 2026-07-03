# Plan 017: Add shared AppShell with navigation, user menu, and system-status footer

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e0d0280..HEAD -- src/app/layout.tsx src/app/page.tsx src/app/log-egg/page.tsx src/app/dashboard/page.tsx src/app/admin/page.tsx src/app/chickens/*/page.tsx src/app/unauthorized/page.tsx src/app/auth/error/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `e0d0280`, 2026-07-03
- **Issue**: (none)

## Why this matters

Every page duplicates its own header, navigation buttons ("Bulk Log", "Dashboard", "Admin", "Back", "Home"), user email, role badge, and sign-out button using inline styles. This makes adding a new page tedious, guarantees visual drift, and buries feature navigation inside each page body. A shared `AppShell` component in the root layout will render the nav bar, user menu, and system-status footer once, letting every page be just page content. This is the prerequisite for the splash screen (Plan 018) and any future UI work.

## Current state

The root layout (`src/app/layout.tsx`) is a thin wrapper with no navigation:

```tsx
// src/app/layout.tsx:10-22
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

Every page re-implements its own header. Examples:

**`src/app/page.tsx:216-335`** — homepage has the title, sign-in button, Bulk Log / Dashboard / Admin links, email + role badge, and Sign Out button, all inline.

**`src/app/log-egg/page.tsx:216-237`** — Bulk Log page has `&larr; Back` link and no other nav.

**`src/app/dashboard/page.tsx:187-217`** — Dashboard page has `Home` link and inline email.

**`src/app/admin/page.tsx:259-301`** — Admin page has `Home` link and inline email + Sign Out.

**`src/app/chickens/[id]/page.tsx:402-439`** — Chicken profile has `&larr; Back` link.

System status (health check) appears only on the homepage (`page.tsx:341-391`) — nowhere else.

**Conventions**: The project uses Next.js 14 App Router, NextAuth v4, all pages are `"use client"`, and all styling is inline JSX `style={}` objects. Match this inline-style convention in new components. No CSS modules, no Tailwind, no CSS-in-JS library.

## Commands you will need

| Purpose   | Command               | Expected on success |
|-----------|-----------------------|---------------------|
| Install   | `npm install`         | exit 0              |
| Build     | `npm run build`       | exit 0, no errors   |
| Lint      | `npm run lint`        | exit 0              |

## Scope

**In scope** (the files you should create or modify):
- `src/components/AppShell.tsx` (create)
- `src/components/NavMenu.tsx` (create)
- `src/components/UserMenu.tsx` (create)
- `src/components/SystemStatusFooter.tsx` (create)
- `src/app/layout.tsx` — wrap children in AppShell
- `src/app/page.tsx` — remove header elements, system status section, and nav links (everything above the "Enrolled Chickens" section heading will be removed or replaced)
- `src/app/log-egg/page.tsx` — remove the `&larr; Back` link wrapper (the `<div>` around lines 225-236)
- `src/app/dashboard/page.tsx` — remove the header bar with `Home` link and inline email (lines 198-216)
- `src/app/admin/page.tsx` — remove the header bar with `Home` link, inline email, and Sign Out (lines 269-300)
- `src/app/chickens/[id]/page.tsx` — remove the `&larr; Back` link and Edit button wrapper (lines 411-438)
- `src/app/unauthorized/page.tsx` — wrap content in AppShell-compatible layout (add `<Providers>` if needed — already provided by layout)
- `src/app/auth/error/page.tsx` — same as unauthorized
- `plans/README.md` — add status row

**Out of scope** (do NOT touch):
- Any API routes (`src/app/api/`)
- `src/lib/` — no backend changes
- `src/types/` — no type changes
- `src/app/providers.tsx` — session provider stays as-is
- Any test files
- The splash/login screen behavior of the homepage (that's Plan 018)

## Git workflow

- Branch: `improve/017-shared-app-shell`
- Use a worktree: `git worktree add ../chicken-017 improve/017-shared-app-shell`
- Work in the worktree directory `../chicken-017/`
- Commit per logical step; message style: conventional commits, e.g. `feat: add AppShell with nav, user menu, and footer`

## Steps

### Step 1: Create the component directory and `AppShell.tsx`

Create `src/components/` directory if it doesn't exist.

Create `src/components/AppShell.tsx` as a `"use client"` component that:

1. Calls `useSession()` to get the auth status.
2. Renders a full-height flex column layout:
   - A **header bar** (top) containing:
     - The app title ("ChickenTrack") as a link to `/` on the left.
     - `<NavMenu />` in the center (when authenticated).
     - `<UserMenu />` on the right (when authenticated); the sign-in button when unauthenticated.
   - A `<main>` area (flex-grow) rendering `{children}`.
   - A `<SystemStatusFooter />` (bottom).
3. Uses inline styles matching the repo's existing style tokens (colors, spacing, fonts).

The `AppShell` component does NOT itself render children — `RootLayout` will wrap `{children}` with `<AppShell>`:

```tsx
// src/components/AppShell.tsx — conceptual structure
"use client";
import { useSession, signIn } from "next-auth/react";
import NavMenu from "./NavMenu";
import UserMenu from "./UserMenu";
import SystemStatusFooter from "./SystemStatusFooter";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header style={{ /* flex row, space-between, padding, border-bottom */ }}>
        <a href="/" style={{ fontSize: "1.25rem", fontWeight: 700, color: "#333", textDecoration: "none" }}>
          ChickenTrack
        </a>
        {status === "authenticated" && <NavMenu />}
        {status === "unauthenticated" && (
          <button onClick={() => signIn("google")} style={/* as in page.tsx:245-256 */}>
            Sign in with Google
          </button>
        )}
        {status === "authenticated" && <UserMenu />}
      </header>
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {children}
      </main>
      <SystemStatusFooter />
    </div>
  );
}
```

Key style tokens to reuse from existing pages:
- Header background: `#fff`, border-bottom: `1px solid #e0e0e0`
- Font family: inherit from body (no font override needed)
- Spacing: `padding: "0.75rem 1.5rem"` for header, `0.5rem` gaps

**Verify**: `npm run build` exits 0. (The component is imported but layout not updated yet.)

### Step 2: Create `NavMenu.tsx`

Create `src/components/NavMenu.tsx` as a `"use client"` component.

It calls `useSession()` and renders a horizontal row of links:
- "Bulk Log" → `/log-egg` (green-tinged background), always visible when authenticated
- "Dashboard" → `/dashboard` (purple-tinged background), always visible when authenticated
- "Admin" → `/admin` (blue-tinged background), only visible when `session.user.role === "Admin"`

Use the same inline button/link style as the current links in `page.tsx:260-301`:
```tsx
// Excerpt from page.tsx:262-279 — match this style
<a href="/log-egg" style={{
  padding: "0.4rem 0.75rem",
  background: "#2e7d32",
  color: "#fff",
  borderRadius: "4px",
  textDecoration: "none",
  fontSize: "0.875rem",
  fontWeight: 600,
}}>Bulk Log</a>
// Dashboard: background "#6a1b9a"
// Admin: background "#1565c0"
```

**Verify**: `npm run build` exits 0.

### Step 3: Create `UserMenu.tsx`

Create `src/components/UserMenu.tsx` as a `"use client"` component.

It calls `useSession()` and renders a clickable button that shows:
- The user's email truncated or their name
- On click, it shows a dropdown/poppver containing:
  - Role badge (styled like `page.tsx:304-316`)
  - Email address
  - Sign Out button (red, like `page.tsx:319-331`)

Implementation approach: use a simple "state toggle" dropdown (no third-party library). A `div` positioned absolutely below the button. Click outside to close (optional but nice).

The default (closed) state shows just the button with the user's email and role badge inline, matching the current `page.tsx:302-316` pattern. The open state adds the sign-out button in a dropdown.

```tsx
// Style reference from page.tsx:302-316
<span style={{ color: "#666", fontSize: "0.875rem" }}>
  {session.user.email}
  <span style={{
    marginLeft: "0.4rem",
    padding: "0.1rem 0.4rem",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontWeight: 600,
    background: isAdmin ? "#e3f2fd" : "#f3e5f5",
    color: isAdmin ? "#1565c0" : "#7b1fa2",
  }}>
    {session.user.role}
  </span>
</span>
```

**Verify**: `npm run build` exits 0.

### Step 4: Create `SystemStatusFooter.tsx`

Create `src/components/SystemStatusFooter.tsx` as a `"use client"` component.

It fetches `/api/health` on mount (same as `page.tsx:102-110`) and renders a compact footer bar:

```
API: Healthy | Database: Connected | As at: <timestamp>
```

Use a `<footer>` element with `border-top: "1px solid #e0e0e0"`, small font (`0.75rem`), muted color.

- When loading: show "Checking system health..."
- When error: show "API unavailable" in red
- When healthy: show the status line with green/red dots or text

Only render when `status === "authenticated"` (no need to show system status to unauthenticated visitors).

The fetch logic:
```tsx
useEffect(() => {
  fetch("/api/health")
    .then(async (res) => {
      const data = await res.json();
      setHealth(data);
    })
    .catch(() => setError("unreachable"));
}, []);
```

**Verify**: `npm run build` exits 0.

### Step 5: Wire AppShell into root layout

Modify `src/app/layout.tsx` to wrap children with `<AppShell>`:

```tsx
// src/app/layout.tsx (after change)
import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import AppShell from "../components/AppShell";

export const metadata: Metadata = { /* unchanged */ };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
```

**Verify**: `npm run build` exits 0. Manually check that all pages render the header, nav menu, user menu, and footer.

### Step 6: Strip duplicated header elements from each page

For each page, remove the inline header/nav/user elements since AppShell now provides them.

**`src/app/page.tsx`**:
- Remove the entire outer `<div>` wrapper from lines 226-335 (the div that contains the title, sign-in button, nav links, email, role badge, sign-out button). This is the `<div style={{ display: "flex", justifyContent: "space-between", ... }}>` block starting at line 226.
- Remove the "Egg-production tracking for your backyard flock" `<p>` (line 337-339).
- Remove the entire System Status section (`<div style={{ padding: "1.5rem 2rem", ... }}>` block, lines 341-391).
- Keep everything from "Enrolled Chickens" heading onward.
- The page should now be just the "Enrolled Chickens" section.

**`src/app/log-egg/page.tsx`**:
- Remove the header `<div>` at lines 216-237 that contains `<h1>Bulk Log</h1>` and `<a href="/">&larr; Back</a>`.
- Keep the `<h1 style={{ fontSize: "1.5rem" }}>Bulk Log</h1>` if it's load-bearing for the page identity. Actually, the header with the h1 and Back link is in lines 216-237. Remove the entire wrapping div and just keep the heading alone if needed — but the page already has enough structure. Minimal change: remove the Back link and its wrapping div; keep the heading styled simply.

**`src/app/dashboard/page.tsx`**:
- Remove the header bar at lines 187-217 (the first `<div style={{ display: "flex", justifyContent: "space-between"... }}>` that contains the `<h1>Analytics Dashboard</h1>`, email span, and `Home` link).
- Keep the `<h1>Analytics Dashboard</h1>` if desired, but it's not duplicated since the AppShell header doesn't include a page title. Keep the h1.

**`src/app/admin/page.tsx`**:
- Remove the header bar at lines 259-301 (the `<div style={{ display: "flex", justifyContent: "space-between"... }}>` containing `<h1>Admin Panel</h1>`, email, `Home` link, and `Sign Out` button).
- Keep the `<h1>Admin Panel</h1>`.

**`src/app/chickens/[id]/page.tsx`**:
- Remove the `&larr; Back` link and its wrapping div (lines 428-438), and the Edit button (lines 412-426) — these are in the `<div style={{ display: "flex", justifyContent: "space-between"... }}>` at lines 402-439. 
- Keep the `<h1>{chicken.name}</h1>`.

**`src/app/unauthorized/page.tsx`** and **`src/app/auth/error/page.tsx`**:
- These pages have no sidebar-style header to remove but they do have their own `<main>` tags. No changes needed since AppShell wraps them with its own `<main>`.

For each page, after removing the duplicated elements, verify the page still builds and the content is correct.

**Verify after each page**: `npm run build` exits 0.

### Step 7: Final verification

Run all checks:

```bash
npm run build  # exit 0
npm run lint   # exit 0
```

Manually verify:
- Every page shows the AppShell header with "ChickenTrack" title.
- When authenticated: NavMenu shows Bulk Log, Dashboard, Admin (if admin role). UserMenu shows email with role badge dropdown.
- When unauthenticated: AppShell shows "Sign in with Google" button.
- Footer shows system health status.
- No page still shows its old inline "Back" or "Home" links.
- No page still shows inline user email/role/sign-out.

**Verify**: All the above pass.

## Test plan

No new tests needed for this refactor — this is purely a layout restructuring. The existing integration tests (`npm test`, `npm run test:integration`) should continue passing since no API or data logic changed.

If any test imports or checks page content that was moved (e.g. checks for "Home" link text), update the test to match the new structure.

## Done criteria

- [ ] `npm run build` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run test` exits 0 (existing tests pass)
- [ ] `npm run test:integration` exits 0 (existing integration tests pass)
- [ ] `src/components/AppShell.tsx`, `NavMenu.tsx`, `UserMenu.tsx`, `SystemStatusFooter.tsx` exist
- [ ] `src/app/layout.tsx` wraps children in `<AppShell>`
- [ ] `src/app/page.tsx` has no inline nav buttons, no user email/role/sign-out, no system-status section
- [ ] `src/app/log-egg/page.tsx` has no `&larr; Back` link
- [ ] `src/app/dashboard/page.tsx` has no `Home` link, no inline email
- [ ] `src/app/admin/page.tsx` has no `Home` link, no inline email, no inline Sign Out button
- [ ] `src/app/chickens/[id]/page.tsx` has no `&larr; Back` link
- [ ] `grep -rn '"&larr; Back"' src/app/` returns no matches
- [ ] `grep -rn 'Back to Home' src/app/` returns no matches (verify in auth/error page too)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts (the codebase has drifted since this plan was written).
- A step's verification fails twice after a reasonable fix attempt.
- The change requires touching an out-of-scope file.
- You discover that a page has navigation or user-info elements that weren't accounted for in Step 6.

## Maintenance notes

- Future pages should NOT add their own header, nav, user info, or system status — the AppShell provides them.
- The `SystemStatusFooter` health check runs on every page mount. If the app grows, consider caching or reducing the polling frequency. For now, the small user base makes this fine.
- The NavMenu uses hardcoded route paths. If routes are renamed, update them here.
- Plan 018 (splash screen) depends on this plan: it modifies the homepage to show a splash when unauthenticated, relying on AppShell for the sign-in button. Do not swap execution order.
