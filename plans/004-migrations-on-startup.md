# Plan 004: Move runMigrations from per-request to application startup

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5761d68..HEAD -- src/lib/db.ts src/app/api/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/003-connection-pool-race.md (both touch `db.ts`; land 003 first to avoid merge conflicts)
- **Category**: perf / correctness
- **Planned at**: commit `5761d68`, 2026-07-01

## Why this matters

`runMigrations()` is called at the top of 9 route handler files, on every API request. It issues ~25+ conditional DDL queries (`IF NOT EXISTS` checks against `sys.tables`, `sys.columns`, `sys.foreign_keys`) per invocation. These queries are idempotent — once all tables exist, every subsequent call is wasted round-trips. Moving the call to application startup eliminates this per-request overhead and removes the import from every route file. Once the DB schema is established (which happens on first request post-deploy), no further migration checks are needed.

## Current state

**`src/lib/db.ts:50-231`** — `runMigrations()` is a ~180-line function with `IF NOT EXISTS` DDL statements. Currently exported and called from 9 route files:

| File | Lines |
|------|-------|
| `src/app/api/chickens/route.ts` | 9, 40 |
| `src/app/api/chickens/[id]/notes/route.ts` | 18, 50 |
| `src/app/api/chickens/[id]/photos/route.ts` | 21, 59 |
| `src/app/api/chickens/[id]/photos/[photoId]/route.ts` | 26, 74 |
| `src/app/api/chickens/[id]/photos/[photoId]/primary/route.ts` | 24 |
| `src/app/api/eggs/route.ts` | 14, 53 |
| `src/app/api/dynamic-lists/[type]/route.ts` | 39, 64 |
| `src/app/api/admin/users/route.ts` | 24, 47 |

**Repo conventions to follow**: Next.js 14 App Router supports `instrumentation.ts` at the project root for startup hooks (see Next.js docs). Alternatively, a simple module-level flag in `db.ts` that runs migrations once on first import works and requires no Next.js feature knowledge. This plan uses the module-level flag approach since it's simpler and doesn't require Next.js config changes.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| Test | `npm test` | all pass |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `src/lib/db.ts` — add auto-run on first import
- All 8 route files listed above — remove `runMigrations` import and call

**Out of scope** (do NOT touch):
- The logic inside `runMigrations()` itself — keep it as-is
- `ensureDatabase()` — keep as-is (it's called at the module level below)
- Test files — tests call `runMigrations()` in `beforeAll`, which should still work since the function is still exported

## Steps

### Step 1: Make runMigrations auto-execute on first import

In `src/lib/db.ts`, at the bottom of the file (after line 231 where `runMigrations()` ends), add an auto-execution block:

```typescript
// Auto-run migrations once at module load time
let migrationsRun = false;
```

And at the very end of the file (after the seed admin logic block), add:

```typescript
export async function ensureMigrations(): Promise<void> {
  if (migrationsRun) return;
  await runMigrations();
  migrationsRun = true;
}

// Auto-run on first import
ensureMigrations().catch((err) => {
  console.error("Migration failed:", err);
});
```

The `runMigrations()` function itself and its export should remain unchanged (existing tests import it directly).

**Verify**: `npx tsc --noEmit` → exit 0, no errors.

### Step 2: Remove runMigrations calls from all route files

For each of the 8 route files listed above, remove:
1. The `import { runMigrations } from "@/lib/db"` line (but keep any other imports from `@/lib/db`, like `ensureDatabase` in admin/users/route.ts which imports only `runMigrations`)
2. Every `await runMigrations();` call

Check each file carefully — some files import `runMigrations` alongside other symbols from `@/lib/db`. Only remove `runMigrations` from the import, leaving any other imports intact.

Files to edit (check each one):

1. `src/app/api/chickens/route.ts` — remove `runMigrations` from import on line 4, remove calls on lines 9 and 40
2. `src/app/api/chickens/[id]/notes/route.ts` — remove `runMigrations` from import, remove calls on lines 18 and 50
3. `src/app/api/chickens/[id]/photos/route.ts` — remove `runMigrations` from import (line 4 only has it), remove calls on lines 21 and 59
4. `src/app/api/chickens/[id]/photos/[photoId]/route.ts` — remove `runMigrations` from import, remove calls on lines 26 and 74
5. `src/app/api/chickens/[id]/photos/[photoId]/primary/route.ts` — remove `runMigrations` from import, remove call on line 24
6. `src/app/api/eggs/route.ts` — remove `runMigrations` from import (line 4 only has it), remove calls on lines 14 and 53
7. `src/app/api/dynamic-lists/[type]/route.ts` — remove `runMigrations` from import (line 4 only has it), remove calls on lines 39 and 64
8. `src/app/api/admin/users/route.ts` — remove `runMigrations` from import (line 5 only has it), remove calls on lines 24 and 47

For files where `runMigrations` is the only symbol imported from `@/lib/db`, remove the entire import line. For files with multiple imports, remove only `runMigrations` from the destructured list.

**Verify after each file**: `npx tsc --noEmit` → exit 0, no errors.

### Step 3: Run full verification

**Verify**: `npm test` → all existing tests pass. Note: tests call `runMigrations()` explicitly in `beforeAll`, which still works since the function is still exported. The auto-run won't interfere because `migrationsRun` flag is per-process and tests import the module fresh.

**Verify**: `npm run lint` → exit 0.

**Verify**: grep for remaining `runMigrations` calls in `src/app/api/` — should only find the definition in `src/lib/db.ts` and no calls in route files.

## Test plan

No new tests. The existing integration tests explicitly call `runMigrations()` in their `beforeAll` blocks — those calls still work and will still run migrations before the test suite. The auto-run in `db.ts` is a no-op when tests explicitly call `runMigrations()` first (the flag ensures idempotency).

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0 (all 6 integration test suites pass)
- [ ] `npm run lint` exits 0
- [ ] `grep -rn "runMigrations" src/app/api/` only returns the entry in `src/lib/db.ts` (the function definition)
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

- The code at the locations above doesn't match the excerpts (codebase has drifted).
- A step's verification fails twice after a reasonable fix attempt.
- The fix requires touching an out-of-scope file.

## Maintenance notes

- The `ensureMigrations()` function is exported and can be called explicitly if a future test or startup path needs to guarantee migrations ran.
- If a new route file is added, it should NOT import or call `runMigrations()` — migrations now auto-run on app startup via the `db.ts` module import.
- The `migrationsRun` flag is process-local. In a serverless deployment (not currently the case — this is a Docker container), each cold start would run migrations once, which is acceptable.
- If the app ever adds new migration statements, they'll auto-run on next deployment restart.
