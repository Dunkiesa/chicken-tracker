# Plan 003: Fix race condition in database connection pool initialization

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5761d68..HEAD -- src/lib/db.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: correctness
- **Planned at**: commit `5761d68`, 2026-07-01

## Why this matters

The `getPool()` function uses a check-then-act pattern on a module-level `pool` variable. If two async calls to `getPool()` arrive before either completes its `await p.connect()`, both pass the `if (pool) return pool` guard and each creates a new `ConnectionPool`. The second assignment overwrites the first in the module variable, leaking the first pool's connections. Under concurrent startup (e.g., health check + first API request), this leaks connections and may eventually exhaust SQL Server's connection limit. Fixing this uses a one-time initialization pattern that guarantees only one pool is ever created.

## Current state

**`src/lib/db.ts:20-27`**:
```typescript
let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool) return pool;                    // race: both calls pass here
  const p = new sql.ConnectionPool(config);
  pool = await p.connect();                 // race: second call overwrites pool
  return pool;
}
```

**Repo conventions to follow**:
- The module uses `mssql` package with `sql.ConnectionPool`, `sql.config` types.
- Error handling: all callers of `getPool()` wrap in try/catch; see `db.ts:40-48` (`checkConnection`) for the existing pattern.
- The rest of `db.ts` (`ensureDatabase`, `checkConnection`, `runMigrations`) should remain unchanged.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| Test | `npm test` | all pass |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope** (the only file you should modify):
- `src/lib/db.ts`

**Out of scope** (do NOT touch):
- Any other file
- The pool `config` object (lines 3-18) — keep as-is
- `runMigrations()`, `ensureDatabase()`, `checkConnection()` — keep as-is

## Steps

### Step 1: Replace check-then-act with one-time promise initialization

Replace the `let pool: sql.ConnectionPool | null = null;` and `getPool()` function with a promise-based lazy initializer:

```typescript
let poolPromise: Promise<sql.ConnectionPool> | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect();
  }
  return poolPromise;
}
```

The key change: the module variable holds a `Promise<ConnectionPool>` instead of a `ConnectionPool | null`. Because JavaScript promise assignment and the `!poolPromise` check both run synchronously (in the same microtask), concurrent calls to `getPool()` will all see the non-null `poolPromise` after the first synchronous assignment and all `await` the same promise. This guarantees exactly one pool is created.

Remove the `let pool` line and replace the entire `getPool` function body.

**Verify**: `npx tsc --noEmit` → exit 0, no errors.

### Step 2: Run full verification

**Verify**: `npm test` → all existing tests pass (tests call `ensureDatabase()` and `runMigrations()` which call `getPool()` internally).

**Verify**: `npm run lint` → exit 0.

## Test plan

No new tests. The existing 6 integration test files all exercise `getPool()` through `ensureDatabase()` + `runMigrations()`, and a pool that doesn't initialize correctly will cause every test to fail. Passing the existing test suite is sufficient verification.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0 (all 6 integration test suites pass)
- [ ] `npm run lint` exits 0
- [ ] The `let pool` declaration is removed from `db.ts` (only `let poolPromise` remains)
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

- The code at the locations above doesn't match the excerpts (codebase has drifted).
- A step's verification fails twice after a reasonable fix attempt. Note: if `npm test` fails, the issue is likely that `poolPromise` rejection is never cleared — the `sql.ConnectionPool(config).connect()` can throw (e.g., DB not reachable), and once the promise rejects, all future calls to `getPool()` will also reject. If this is a concern, add a `.catch()` that resets `poolPromise = null` on first rejection, and mention it in the maintenance notes. **Do not add this reset without first verifying the current behavior during tests** — the Docker healthcheck (`depends_on: db: condition: service_healthy`) means the DB is always reachable when the app starts.
- The fix requires touching an out-of-scope file.

## Maintenance notes

- The one-time promise pattern means that if the initial pool connection fails (e.g., DB is down), `poolPromise` will be a rejected promise and all subsequent calls to `getPool()` will also reject. This is acceptable with the Docker setup because the `depends_on: condition: service_healthy` ensures the DB is ready before the app starts. If the app is ever run without Docker healthcheck guarantees, add a `.catch()` that resets `poolPromise = null`:
  ```typescript
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect().catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  ```
- Plan 004 (migrations on startup) also touches `db.ts` — this plan should land before Plan 004 to avoid merge conflicts on the same file.
