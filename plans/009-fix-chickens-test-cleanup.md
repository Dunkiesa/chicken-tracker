# Plan 009: Fix chickens integration test data persistence failures

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat aaef762..HEAD -- tests/chickens.integration.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `aaef762`, 2026-07-02

## Why this matters

Every run of `npm test` fails with 10 UNIQUE KEY constraint violations in `tests/chickens.integration.test.ts` because test data persists in the database between runs. This makes the test suite unreliable — you cannot run tests twice in a row without manual database cleanup. Since the other 6 test suites pass, this one suite is the sole gate that makes `npm test` exit non-zero, suppressing feedback on whether other changes broke anything.

## Current state

The file `tests/chickens.integration.test.ts` (142 lines) has two describe blocks — "Chickens" (7 tests) and "Dynamic Lists" (7 tests). The tests call `createChicken()` and `createValue()` with hardcoded names:

**Chickens block** (`tests/chickens.integration.test.ts:12-81`) — tests create chickens named:
- "Henrietta" (line 13)
- "Minimal Hen" (line 29)
- "Cluck Norris" / "Egg Sheeran" (lines 41-46, conditional — only if not already present)
- "Dup Test" (line 55)
- "  Trimmed Hen  " (line 60)
- "Departed Bird" (line 65)

**Dynamic Lists block** (`tests/chickens.integration.test.ts:84-141`) — tests create values named:
- "Leghorn", "Australorp" (line 86-87)
- "Silkie" (line 95)
- "Old Name" / "New Name" (lines 101-102)
- "Merge Source" / "Merge Target" (lines 110-111)
- "In Use Source" (line 131)
- "Unused Source" (line 137)

The `chickens.name` column has a UNIQUE constraint (`src/lib/db.ts:83`). The `breeds.value`, `origin_sources.value`, and `acquisition_types.value` columns also have UNIQUE constraints (`db.ts:58,66,74`). Once a name is inserted, the next test run fails trying to re-insert it.

The `beforeAll` hook (lines 5-8) calls `ensureDatabase()` and `runMigrations()` but never cleans up data. There is no `afterAll` or `beforeEach` cleanup.

Other test files handle this with an `ensureHen` pattern that checks for existing records before creating. That pattern can't work cleanly for this test file because several tests specifically test insertion behavior (reject duplicates, trim whitespace, etc.) and need a known-empty initial state.

**Repo conventions** (for the executor):
- Test files use `beforeAll` + `afterAll` with async/await for setup/teardown — see `tests/auth.integration.test.ts:12-24` for the cleanup pattern.
- Database access through `@/lib/db`'s `getPool()` — see its use in `src/lib/db.ts:22-27`.
- The project uses `ts-jest` with the `@/` path alias mapped to `<rootDir>/src` (`jest.config.ts:9`).
- Module imports follow `import { ... } from "@/lib/..."` convention.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Tests     | `npm test`               | exit 0, all 72 tests pass |
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |

## Scope

**In scope** (the only files you should modify):
- `tests/chickens.integration.test.ts`

**Out of scope** (do NOT touch):
- Any other test file — they pass already and have their own patterns.
- Any source file under `src/` — the production code is fine.
- `tests/setup.ts` — it only loads dotenv.
- Any config files (`jest.config.ts`, `package.json`).

## Git workflow

- Branch: `improve/009-fix-chickens-test-cleanup` (per CLAUDE.md convention)
- Commit message style: `fix: add test data cleanup to chickens integration tests` (conventional commits, matching `git log` style)
- Do NOT push or open a PR.

## Steps

### Step 1: Add a `beforeEach` cleanup hook

Add a `beforeEach` function (at the top level of the file, after `beforeAll`) that deletes all test data from the relevant tables in foreign-key-safe order. Import `getPool` from `@/lib/db` alongside the existing imports.

**What to add:**

After the existing `beforeAll` block (lines 5-8), add:

```typescript
import { ensureDatabase, runMigrations, getPool } from "@/lib/db";
```

Change the `import` on line 1 from:
```typescript
import { ensureDatabase, runMigrations } from "@/lib/db";
```
to:
```typescript
import { ensureDatabase, runMigrations, getPool } from "@/lib/db";
```

Then add a `beforeEach` hook between the `beforeAll` and the first `describe`:

```typescript
beforeEach(async () => {
  const pool = await getPool();
  // Delete in FK-safe order: child tables first, then parents
  await pool.request().query("DELETE FROM photos");
  await pool.request().query("DELETE FROM notes");
  await pool.request().query("DELETE FROM eggs");
  await pool.request().query("DELETE FROM chickens");
  await pool.request().query("DELETE FROM acquisition_types");
  await pool.request().query("DELETE FROM origin_sources");
  await pool.request().query("DELETE FROM breeds");
}, 30000);
```

This ensures every test starts with empty tables. The order matters: `photos`, `notes`, and `eggs` reference `chickens`; `chickens` references the dynamic-list tables; the dynamic-list tables have no FK dependencies between them.

The timeout of 30000 is consistent with the `beforeAll` timeout on line 8.

**Verify**: `npm test` — the chickens integration tests should no longer fail with UNIQUE KEY violations. All 72 tests should pass.

### Step 2: Run full test suite

**Verify**: `npm test` → exit 0, all 72 tests pass.

**Verify**: `npx tsc --noEmit` → exit 0, no type errors.

## Test plan

No new tests to write. The change itself is a test-infrastructure fix: adding cleanup to an existing test file to make the existing tests idempotent.

The existing 10 currently-failing tests in `tests/chickens.integration.test.ts` will pass:
- "Chickens > creates a chicken with full enrollment and assigns a unique ID"
- "Chickens > creates a chicken with minimal fields (name + sex only)"
- "Chickens > rejects duplicate names"
- "Chickens > trims whitespace from names"
- "Chickens > sets a chicken as departed and excludes from default list"
- "Dynamic Lists > creates and lists breeds"
- "Dynamic Lists > deduplicates case-insensitively"
- "Dynamic Lists > renames a value"
- "Dynamic Lists > merges values and re-points chickens"
- "Dynamic Lists > refuses to remove a value that is in use"

The existing 6 passing test files must remain passing:
- `health.integration.test.ts`
- `auth.integration.test.ts`
- `eggs.integration.test.ts`
- `notes.integration.test.ts`
- `photos.integration.test.ts`
- `analytics.integration.test.ts`

Manual verification: run `npm test` twice in a row without any database reset between runs. Both runs must pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm test` exits 0 (all 72 tests pass)
- [ ] `npx tsc --noEmit` exits 0
- [ ] Running `npm test` a second time immediately after first also exits 0
- [ ] Only `tests/chickens.integration.test.ts` is modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `tests/chickens.integration.test.ts:1-8` doesn't match the imports excerpt (the codebase has drifted).
- `npm test` still shows UNIQUE KEY constraint failures in `chickens.integration.test.ts` after step 1 — this indicates the pool connection isn't cleaning the expected data.
- Another test suite breaks after the cleanup is added (indicating test-order dependence).
- You discover that `DELETE FROM photos` fails due to FK constraints — this would mean the FK order in the cleanup is wrong (unlikely given the schema in `src/lib/db.ts` but possible if migrations have changed).

## Maintenance notes

- If new tables are added to the database schema with FKs to `chickens` or the dynamic-list tables, the `beforeEach` cleanup must be updated to include those tables in the correct order.
- If new test files are added that share the same database, they should follow either the `ensureHen` pattern or add their own `beforeEach` cleanup. Adding cleanup to the shared setup file (`tests/setup.ts`) would be a future improvement but is out of scope for this plan.
- The `beforeEach` runs before every individual test (not just once per describe block). This is intentional: each test needs a clean slate because some tests test insertion behavior (e.g., "rejects duplicate names") that leaves data behind.
