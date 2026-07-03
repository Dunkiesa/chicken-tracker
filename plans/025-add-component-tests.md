# Plan 025: Add component tests for new UI components

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
- **Effort**: L
- **Risk**: LOW
- **Depends on**: none (recommended before Plans 026, 027, 028)
- **Category**: tests
- **Planned at**: commit `9f05e7b`, 2026-07-03

## Why this matters

All 5 new/changed UI components (AppShell, NavMenu, UserMenu, SystemStatusFooter, RosterPage) have zero test coverage. These components handle auth-gating logic (isAdmin checks, redirects), form behavior (enrollment, departure, egg weight entry), and interactive state management. No automated regression protection exists for any of them. The project already has `@testing-library/react` and `@testing-library/jest-dom` as devDependencies but no component tests use them.

## Current state

`package.json:21-22` lists test libraries but they're unused:

```json
"@testing-library/jest-dom": "^6.6.2",
"@testing-library/react": "^16.0.1",
```

`jest.config.ts` uses `testEnvironment: "node"` — incompatible with React component tests (needs `"jsdom"`). No component test files exist.

The project has 7 integration test files under `tests/` (backend-only). Example test pattern from `tests/eggs.integration.test.ts`:

```tsx
import { createEgg, listEggs } from "@/lib/eggs";
// Uses beforeAll/afterAll for setup, it() for tests, expect() for assertions
```

Existing components use these patterns:
- `useSession()` from `next-auth/react` for auth state
- `useRouter()` from `next/navigation` for navigation
- Inline styles (`style={{}}`) on all elements

## Commands you will need

| Purpose      | Command                                       | Expected on success |
|--------------|-----------------------------------------------|---------------------|
| Install      | `npm install`                                 | exit 0              |
| Build        | `npm run build`                               | exit 0              |
| All tests    | `npm test`                                     | all pass            |
| Unit tests   | `npx jest --config jest.component.config.ts`   | all pass            |
| Typecheck    | `npx tsc --noEmit`                            | exit 0              |

## Scope

**In scope**:
- `jest.component.config.ts` (CREATE) — new jest config for jsdom-based component tests
- `tests/components/AppShell.test.tsx` (CREATE)
- `tests/components/NavMenu.test.tsx` (CREATE)
- `tests/components/UserMenu.test.tsx` (CREATE)
- `tests/components/SystemStatusFooter.test.tsx` (CREATE)
- `tests/components/RosterPage.test.tsx` (CREATE)

**Out of scope**:
- Integration tests for API routes
- Tests for the home page analytics dashboard (deferred — complex data-fetching logic)
- Tests for admin page, log-egg page, chicken profile page (deferred — large components)
- Any modification to source components or pages
- The existing integration tests under `tests/`

## Git workflow

- Branch: `improve/025-add-component-tests`
- Commits: one per test file, or one bulk commit
- Message: `test: add component tests for AppShell, NavMenu, UserMenu, SystemStatusFooter, RosterPage`
- Do NOT push or open a PR

## Steps

### Step 1: Create Jest config for component tests

Create `jest.component.config.ts` at the project root:

```tsx
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/tests/components"],
  setupFiles: ["<rootDir>/tests/setup.ts"],
  setupFilesAfterSetup: ["@testing-library/jest-dom"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
};

export default config;
```

**Verify**: `npx jest --config jest.component.config.ts` runs and finds 0 tests (no test files exist yet), exits 0.

### Step 2: Create test utilities

Create `tests/components/setup.ts` with mock providers for Next.js and NextAuth:

```tsx
import { jest } from "@jest/globals";

// Mock next-auth/react
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
  })),
  useParams: jest.fn(() => ({})),
  usePathname: jest.fn(() => "/"),
}));
```

**Verify**: Import this in a test file temporarily and confirm mocks resolve.

### Step 3: Write `AppShell.test.tsx`

Create `tests/components/AppShell.test.tsx`. Test cases:

1. **Renders the ChickenTrack title** — regardless of auth state, the app title link should always be present
2. **Shows NavMenu and UserMenu when authenticated** — mock `useSession` to return `{ status: "authenticated", data: { user: { email: "admin@test.com", role: "Admin" } } }`, verify NavMenu and UserMenu render
3. **Does not show NavMenu or UserMenu when unauthenticated** — mock `{ status: "unauthenticated" }`, verify they're absent
4. **Renders SystemStatusFooter** — verify the footer element is present

Use `render(<AppShell><div>test child</div></AppShell>)` and `screen.getByText` / `screen.queryByText` assertions.

**Verify**: Only this test file is run: `npx jest --config jest.component.config.ts tests/components/AppShell.test.tsx` — all tests pass.

### Step 4: Write `NavMenu.test.tsx`

Create `tests/components/NavMenu.test.tsx`. Test cases:

1. **Shows Log and Roster links for viewers** — mock viewer role, verify "Log" and "Roster" links are present, "Dashboard" and "Admin" are absent
2. **Shows Dashboard and Admin links for admins** — mock admin role, verify all four links present
3. **Each link has correct href** — verify Log → `/log-egg`, Dashboard → `/`, Roster → `/roster`, Admin → `/admin`

**Verify**: `npx jest --config jest.component.config.ts tests/components/NavMenu.test.tsx` — all pass.

### Step 5: Write `UserMenu.test.tsx`

Create `tests/components/UserMenu.test.tsx`. Test cases:

1. **Shows user email and role when closed** — mock session with email and role, verify button text contains email and role badge
2. **Opens dropdown on click** — click the button, verify the dropdown menu appears with email and sign-out button
3. **Closes dropdown on outside click** — open dropdown, click outside, verify dropdown closes
4. **Shows correct role badge color for Admin vs Viewer** — test `role: "Admin"` and `role: "Viewer"` produce different badge styling

**Verify**: `npx jest --config jest.component.config.ts tests/components/UserMenu.test.tsx` — all pass.

### Step 6: Write `SystemStatusFooter.test.tsx`

Create `tests/components/SystemStatusFooter.test.tsx`. Test cases:

1. **Does not render when unauthenticated** — mock `status: "unauthenticated"`, verify `container.firstChild` is null
2. **Shows checking state when authenticated but health not yet loaded** — mock `status: "authenticated"`, mock `fetch` to return a pending promise, verify "Checking system health..." text
3. **Shows healthy state on successful fetch** — mock `fetch` to resolve with `{ status: "ok", database: "connected", timestamp: "2026-07-03T00:00:00Z" }`, verify "Healthy" and "Connected" text
4. **Shows error state on fetch failure** — mock `fetch` to reject, verify "API unavailable" text

**Verify**: `npx jest --config jest.component.config.ts tests/components/SystemStatusFooter.test.tsx` — all pass.

### Step 7: Write `RosterPage.test.tsx`

Create `tests/components/RosterPage.test.tsx`. This is the most complex test file. Mock `fetch` globally for the data-fetching calls. Test cases:

1. **Shows loading state** — mock `status: "loading"`, verify "Loading..." text
2. **Redirects to / when unauthenticated** — mock `status: "unauthenticated"`, verify `router.replace("/")` was called
3. **Shows enroll form for admins** — mock admin role, mock `fetch` to return empty arrays, verify "Add Chicken" button is present
4. **Hides enroll form for viewers** — mock viewer role, verify "Add Chicken" button is absent, verify "only admins can add" message
5. **Shows chicken list** — mock fetch to return a chicken array with one active hen, verify chicken name appears in the table

**Verify**: `npx jest --config jest.component.config.ts tests/components/RosterPage.test.tsx` — all pass.

### Step 8: Update package.json test script

Add a `test:components` script to `package.json`:

```json
"test:components": "jest --config jest.component.config.ts"
```

**Verify**: `npm run test:components` runs all component tests and exits 0.

## Test plan

The test files ARE the test plan. Summary:

| File | Tests | Focus |
|------|-------|-------|
| `AppShell.test.tsx` | 4 | Auth state rendering, children slot |
| `NavMenu.test.tsx` | 3 | Admin vs viewer link visibility |
| `UserMenu.test.tsx` | 4 | Open/close, role badges, outside click |
| `SystemStatusFooter.test.tsx` | 4 | Auth gate, fetch states |
| `RosterPage.test.tsx` | 5 | Auth guards, role-based UI, data rendering |

## Done criteria

- [ ] `npx jest --config jest.component.config.ts` exits 0, all 20+ tests pass
- [ ] `npm run build` exits 0
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` still passes (existing integration tests unaffected)

## STOP conditions

- If `@testing-library/react` or `@testing-library/jest-dom` have been removed from `package.json`, stop and report (they're needed for these tests).
- If any source component has been substantially rewritten (signature change), stop and report which component.
- If `ts-jest` with `jsdom` has configuration issues (ESM module resolution), try adding `"module": "commonjs"` to the transform's tsconfig override.

## Maintenance notes

- Component tests use mocked auth/router/fetch — they don't require a running database or server. Keep them fast (< 100ms each).
- If a new component is added to `src/components/`, follow the same pattern: create a corresponding `tests/components/<Component>.test.tsx`.
- The `jest.component.config.ts` uses `jsdom` while the main jest config uses `node` — they are separate test suites and should remain so.
- If Next.js introduces breaking changes to `useSession` or `useRouter` mocks, update the mock in `tests/components/setup.ts`.
