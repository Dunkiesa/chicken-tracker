# Plan 033: Database connection recovery from delayed startup and outages

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 508e3c6..HEAD -- src/lib/db.ts src/app/api/health/route.ts tests/health.integration.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness / tech-debt
- **Planned at**: commit `508e3c6`, 2026-09-15

## Why this matters

Currently, the application assumes SQL Server is already running and reachable when the Node.js process starts. If the database is started after the application, the initial connection failure permanently latches `poolPromise` into a rejected state and aborts startup migrations; subsequent API requests never retry connecting and fail indefinitely until the app is restarted. Similarly, if the database suffers a temporary outage or restart while the app is running, the pool is not automatically recycled, unhandled `'error'` events are emitted by `mssql`, and queries fail to recover. Fixing this ensures the app seamlessly connects once the database becomes available (whether after cold start or after an outage) without manual app restarts.

## Current state

The relevant files and their roles:
- `src/lib/db.ts` — Centralized database connection pool management, database creation (`ensureDatabase`), health check (`checkConnection`), and schema migrations (`runMigrations`, `ensureMigrations`).
- `src/app/api/health/route.ts` — Health check endpoint queried by frontend `HealthIndicator` every 60s.
- `tests/health.integration.test.ts` — Health check test suite.

**Current `src/lib/db.ts:20-27`**:
```typescript
let poolPromise: Promise<sql.ConnectionPool> | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect();
  }
  return poolPromise;
}
```
*Problems*:
1. If `new sql.ConnectionPool(config).connect()` rejects (e.g. DB is offline), `poolPromise` retains the rejected Promise. Future calls to `getPool()` immediately throw the cached rejection without attempting to connect.
2. If the connection pool is connected but later drops (`!pool.connected`), `getPool()` continues returning the dead pool.
3. No `'error'` event listener is attached to `ConnectionPool`, causing Node to throw `ERR_UNHANDLED_ERROR` on background pool/socket drops.

**Current `src/lib/db.ts:320-337`**:
```typescript
let migrationsRun = false;
let migrationsPromise: Promise<void> | null = null;

export async function ensureMigrations(): Promise<void> {
  if (migrationsPromise) return migrationsPromise;
  if (migrationsRun) return;
  migrationsPromise = runMigrations();
  try {
    await migrationsPromise;
    migrationsRun = true;
  } finally {
    migrationsPromise = null;
  }
}

ensureMigrations().catch((err) => {
  console.error("Migration failed:", err);
});
```
*Problems*:
1. `ensureMigrations()` is only triggered once at top-level module load.
2. If SQL Server is not running on startup, `ensureMigrations()` catches the error and exits, leaving `migrationsRun = false`.
3. Route handlers never call `ensureMigrations()`. If the DB starts afterwards, even if a connection succeeded, migrations have not executed, leaving tables/columns uninitialized.

**Repo conventions to follow**:
- Connection parameters and types use `mssql` (`sql.ConnectionPool`, `sql.config`).
- All asynchronous functions return standard Promises.
- Tests use Jest (`npm test`, `npm run test:all`).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Tests     | `npm test`               | all pass            |
| All tests | `npm run test:all`       | all pass            |
| Lint      | `npm run lint`           | exit 0              |
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope** (the only files you should modify or create):
- `src/lib/db.ts` — add resilient pool management, error handling, auto-recovery, and lazy migration execution.
- `src/app/api/health/route.ts` — simplify health route to rely on resilient connection check.
- `tests/db_resilience.test.ts` (create) — unit/resilience tests for connection retry, pool reset, and recovery.

**Out of scope** (do NOT touch):
- `src/lib/chickens.ts`, `src/lib/eggs.ts`, `src/lib/users.ts`, `src/lib/notes.ts`, `src/lib/photos.ts`, `src/lib/dynamic-lists.ts`, `src/lib/analytics.ts` — all consume `getPool()` which retains its signature `Promise<sql.ConnectionPool>`.
- `CONTEXT.md`, `CLAUDE.md`, `GEMINI.md` — domain documentation.
- Database schema / DDL queries inside `runMigrations()` — existing schema statements remain unchanged.

## Git workflow

- Branch: `improve/033-database-recovery`
- Worktree: `../Chicken-database-recovery`
- Commit message style: `fix(db): recover connection on delayed startup and post-outage`

## Steps

### Step 1: Refactor `src/lib/db.ts` for Resilient Pool Lifecycle and Migrations

In `src/lib/db.ts`, update the pool and migration state handling:

1. Maintain `activePool`, `poolPromise`, `migrationsRun`, and `migrationsPromise` references.
2. Update `ensureDatabase()`: Connects to `master` database using a temporary connection with `try ... finally { await masterPool.close(); }` to ensure no connection leaks.
3. Update `getPool()`:
   - If `activePool` exists and `activePool.connected` is `true`, return `activePool`.
   - If `activePool` exists but `!activePool.connected`, close it safely and reset `activePool = null`, `poolPromise = null`.
   - If `poolPromise` is already in flight, return `poolPromise`.
   - Create a connection pipeline that:
     a. Runs `ensureDatabase()` to guarantee the target catalog exists.
     b. Creates `new sql.ConnectionPool(config)`.
     c. Attaches an error handler: `pool.on("error", (err) => { ... })` to log and mark `activePool = null`, `poolPromise = null` when `!pool.connected`.
     d. Awaits `pool.connect()`.
     e. Sets `activePool = pool`.
     f. Runs `ensureMigrations(pool)` so migrations are guaranteed before queries run on a fresh connection.
     g. Returns `pool`.
   - On connection failure (catch block):
     - Reset `poolPromise = null`.
     - Reset `activePool = null`.
     - Re-throw the error so callers receive the rejection.
4. Update `ensureMigrations()`:
   - Accept optional `existingPool?: sql.ConnectionPool`.
   - Ensure idempotent execution: if `migrationsRun` is `true`, return immediately.
   - If `migrationsPromise` is active, return it.
   - Guard execution so concurrent calls share the same migration promise.
5. Update `closePool()`:
   - Await any pending `migrationsPromise`.
   - Safely close `activePool`.
   - Reset `activePool = null`, `poolPromise = null`, `migrationsRun = false`.
6. Update `checkConnection()`:
   - Query `SELECT 1 AS result`.
   - On error, call `await closePool()` to ensure dead connections are cleared, and return `false`.
7. Update module-level auto-run:
   - Change `ensureMigrations().catch(...)` to log a warning on startup failure rather than an unhandled error, allowing the app to start up smoothly even if the DB is offline.

Target code shape for `src/lib/db.ts`:

```typescript
import sql from "mssql";

const config: sql.config = {
  server: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "1433", 10),
  database: process.env.DB_NAME || "ChickenTrack",
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let activePool: sql.ConnectionPool | null = null;
let poolPromise: Promise<sql.ConnectionPool> | null = null;
let migrationsRun = false;
let migrationsPromise: Promise<void> | null = null;

export async function ensureDatabase(): Promise<void> {
  const masterConfig = { ...config, database: "master" };
  const masterPool = new sql.ConnectionPool(masterConfig);
  try {
    await masterPool.connect();
    await masterPool.request().query(
      `IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '${config.database}')
       CREATE DATABASE ${config.database}`
    );
  } finally {
    try {
      await masterPool.close();
    } catch {
      // Ignore cleanup error on master pool
    }
  }
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (activePool && activePool.connected) {
    return activePool;
  }

  if (activePool && !activePool.connected) {
    try {
      await activePool.close();
    } catch {
      // Ignore close error on dead pool
    }
    activePool = null;
    poolPromise = null;
  }

  if (poolPromise) {
    return poolPromise;
  }

  poolPromise = (async () => {
    await ensureDatabase();

    const pool = new sql.ConnectionPool(config);

    pool.on("error", (err) => {
      console.error("Database pool background error:", err);
      if (!pool.connected) {
        if (activePool === pool) {
          activePool = null;
        }
        poolPromise = null;
      }
    });

    await pool.connect();
    activePool = pool;

    await ensureMigrationsInternal(pool);

    return pool;
  })().catch((err) => {
    poolPromise = null;
    if (activePool) {
      try {
        activePool.close();
      } catch {
        // Ignore close error
      }
      activePool = null;
    }
    throw err;
  });

  return poolPromise;
}

export async function closePool(): Promise<void> {
  if (migrationsPromise) {
    try {
      await migrationsPromise;
    } catch {
      // Ignore migration errors during cleanup
    }
  }
  const pool = activePool;
  activePool = null;
  poolPromise = null;
  migrationsRun = false;
  if (pool) {
    try {
      await pool.close();
    } catch {
      // Ignore connection errors during cleanup
    }
  }
}

export async function checkConnection(): Promise<boolean> {
  try {
    const p = await getPool();
    await p.request().query("SELECT 1 AS result");
    return true;
  } catch {
    await closePool();
    return false;
  }
}

export async function runMigrations(existingPool?: sql.ConnectionPool): Promise<void> {
  const p = existingPool || (await getPool());

  // ... (existing DDL queries unchanged) ...
}

async function ensureMigrationsInternal(pool?: sql.ConnectionPool): Promise<void> {
  if (migrationsRun) return;
  if (migrationsPromise) return migrationsPromise;

  migrationsPromise = (async () => {
    await runMigrations(pool);
    migrationsRun = true;
  })().finally(() => {
    migrationsPromise = null;
  });

  return migrationsPromise;
}

export async function ensureMigrations(): Promise<void> {
  if (migrationsRun) return;
  if (migrationsPromise) return migrationsPromise;
  const pool = await getPool();
  return ensureMigrationsInternal(pool);
}

// Background auto-run on module load (non-blocking, logs warning if DB not yet up)
ensureMigrations().catch((err) => {
  console.warn("Initial DB connection/migration deferred (DB not ready):", err instanceof Error ? err.message : err);
});
```

**Verify**: `npx tsc --noEmit` → exit 0, no errors.

---

### Step 2: Simplify `src/app/api/health/route.ts`

In `src/app/api/health/route.ts`, remove redundant `await ensureDatabase()` call since `checkConnection()` -> `getPool()` already ensures database creation and migration:

```typescript
import { NextResponse } from "next/server";
import { checkConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const healthy = await checkConnection();

    if (healthy) {
      return NextResponse.json({
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
```

**Verify**: `npx tsc --noEmit` → exit 0, no errors.

---

### Step 3: Add DB Resilience Unit Tests in `tests/db_resilience.test.ts`

Create `tests/db_resilience.test.ts` to test:
1. `getPool()` retries after a rejected connection attempt (does not latch into a failed promise).
2. `getPool()` coalesces concurrent calls into a single connection attempt.
3. `getPool()` detects when `activePool.connected === false`, discards the disconnected pool, and creates a fresh connection.
4. `checkConnection()` returns `false` on failure and resets the pool for subsequent attempts.
5. `closePool()` cleanly resets `activePool`, `poolPromise`, and `migrationsRun`.

**Verify**: `npx jest tests/db_resilience.test.ts` → all tests pass.

---

### Step 4: Run Full Test Suite and Lint

Run all verification gates:

**Verify**: `npm run test:all` → all unit, integration, and component tests pass.
**Verify**: `npm run lint` → exit 0.
**Verify**: `npm run build` → exit 0.

## Test plan

- **New Test Suite**: `tests/db_resilience.test.ts`
  - Test 1: Simulating initial connection failure then subsequent success verifies `poolPromise` is cleared on rejection and retries cleanly.
  - Test 2: Simulating broken/disconnected pool (`pool.connected = false`) verifies `getPool()` detects disconnection, closes dead pool, and reconnects.
  - Test 3: Concurrent `getPool()` calls while connecting return the same promise without creating duplicate pools.
  - Test 4: `checkConnection()` returns `false` during simulated outage and clears pool state.
  - Test 5: `closePool()` resets state and allows fresh `getPool()` call.
- **Existing Tests**:
  - `tests/health.integration.test.ts`
  - `tests/chickens.integration.test.ts`
  - `tests/eggs.integration.test.ts`
  - `tests/notes.integration.test.ts`
  - `tests/photos.integration.test.ts`
  - `tests/components/HealthIndicator.test.tsx`
- **Verification Command**: `npm run test:all`

## Done criteria

- [ ] `npx tsc --noEmit` exits 0 with no type errors.
- [ ] `npm run test:all` exits 0 with all test suites passing.
- [ ] `npm run lint` exits 0 with no lint errors.
- [ ] `npm run build` exits 0.
- [ ] When DB is offline during app import, `db.ts` does not emit `ERR_UNHANDLED_ERROR` and does not latch `poolPromise` into a permanently rejected state.
- [ ] When DB becomes online later, calling `getPool()` or hitting `/api/health` successfully establishes connection and applies migrations.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- The code at `src/lib/db.ts` has drifted significantly from the excerpts.
- Verification commands fail twice after reasonable fix attempts.
- Changes require altering the public API of `getPool()` or altering caller signatures in `src/lib/*.ts`.

## Maintenance notes

- In Next.js App Router, route handlers run on Node.js runtime. Database connections are pooled in memory per Node process.
- `ensureDatabase()` connects to `master` to create `ChickenTrack` if absent; if deploying to an environment where the database user lacks `master` access (e.g. restricted cloud SQL instance), `ensureDatabase()` should catch permission errors and proceed to let `getPool()` attempt direct connection.
- `activePool.on("error")` handles asynchronous connection drops (e.g. idle socket resets, server restarts) and resets the pool so the next query will establish a healthy connection.
