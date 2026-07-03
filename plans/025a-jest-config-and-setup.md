# Plan 025a: Jest config and test utilities for component tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9f05e7b..HEAD -- src/components tests/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L (Shared with 025)
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `9f05e7b`, 2026-07-03

## Why this matters

Component tests require a different Jest environment (`jsdom`) and specific mocking for Next.js and NextAuth. This setup provides the foundational infrastructure for all component-level regression testing.

## Current state

`package.json:21-22` lists test libraries but they're unused:

```json
"@testing-library/jest-dom": "^6.6.2",
"@testing-library/react": "^16.0.1",
```

`jest.config.ts` uses `testEnvironment: "node"` — incompatible with React component tests (needs `"jsdom"`). No component test files or mock utilities exist.

## Commands you will need

| Purpose      | Command                                       | Expected on success |
|--------------|-----------------------------------------------|---------------------|
| Install      | `npm install`                                 | exit 0              |
| Build        | `npm run build`                               | exit 0              |
| Unit tests   | `npx jest --config jest.component.config.ts`   | all pass            |
| Typecheck    | `npx tsc --noEmit`                            | exit 0              |

## Scope

**In scope**:
- `jest.component.config.ts` (CREATE) — new jest config for jsdom-based component tests
- `tests/components/setup.ts` (CREATE) — test utilities and mocks

**Out of scope**:
- Writing actual component tests (deferred to 025b-f)
- Updating package.json scripts (deferred to 025g)

## Git workflow

- Branch: `improve/025a-jest-config-and-setup`
- Commits: one per file
- Message: `test: setup jest config and utilities for component tests`
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

## Done criteria

- [ ] `npx jest --config jest.component.config.ts` exits 0, all tests (0) pass
- [ ] `tests/components/setup.ts` created with correct mocks
- [ ] `npm run build` exits 0
- [ ] `npx tsc --noEmit` exits 0

## STOP conditions

- If `ts-jest` with `jsdom` has configuration issues (ESM module resolution), stop and report.
- If `npm run build` fails due to the new config file.

## Maintenance notes

- `jest.component.config.ts` uses `jsdom` while the main jest config uses `node`. These are separate test suites and should remain so.
- The mocks in `tests/components/setup.ts` should be updated if Next.js or NextAuth APIs change.
