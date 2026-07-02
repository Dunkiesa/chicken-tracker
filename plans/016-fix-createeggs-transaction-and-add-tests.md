# Plan 016: Fix `createEggs` transaction deadlock and add integration tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4442f83..HEAD -- src/lib/eggs.ts tests/eggs.integration.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Category**: bug + tests
- **Depends on**: none
- **Planned at**: commit `4442f83`, 2026-07-02
- **Supersedes**: plan 012 (BLOCKED — same tests, but pre-requisite bug fix now included)

## Why this matters

`createEggs` in `src/lib/eggs.ts` is the batch egg insertion function used by the Bulk Log page. It has zero test coverage and a transaction deadlock: after inserting a row inside a transaction, it calls `getEgg(id)` which uses `getPool()` (a different connection). The INSERT's exclusive lock blocks the SELECT on the other connection, but the transaction can't commit until `getEgg` returns — producing an infinite hang. The function is dead code today (never imported/called anywhere in `src/`), so this bug was never caught. This plan fixes the deadlock and adds integration tests to prevent regressions.

## Current state

`src/lib/eggs.ts:154-156` — inside the transaction loop, `createEggs` calls `getEgg()` via the pool (separate connection):

```tsx
const id = result.recordset[0].id;
const egg = await getEgg(id);
eggs.push(egg!);
warnings.push(eggWarnings);
```

`getEgg` uses `getPool()` (not the transaction):

```tsx
// src/lib/eggs.ts:191-198
export async function getEgg(id: number): Promise<Egg | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`${EGG_SELECT_SQL} WHERE e.id = @id`);
  return (result.recordset[0] as Egg) || null;
}
```

The `EGG_SELECT_SQL` constant is defined at `src/lib/eggs.ts:40-49`.

`tests/eggs.integration.test.ts` imports from `@/lib/eggs` (lines 2-12), currently does not import `createEggs`, `CreateEggInput`, or `CreateEggWarning`.

The "Edit/delete authorization" describe block ends at line 398. The "Last Used Chicken" describe block starts at line 400.

## Commands you will need

| Purpose              | Command                              | Expected on success       |
|----------------------|--------------------------------------|---------------------------|
| Build                | `npm run build`                      | exit 0                    |
| Integration tests    | `npm run test:integration`           | all tests pass            |
| Run single test file | `npx jest --config jest.integration.config.ts tests/eggs.integration.test.ts` | all tests pass |
| Quick verify fix     | `npx tsx -e "<inline script>"`       | exits 0 (see step 1 verify) |

## Scope

**In scope**:
- `src/lib/eggs.ts` — fix the `createEggs` function (one line changed, one line added)
- `tests/eggs.integration.test.ts` — add import and new describe block

**Out of scope**:
- Other functions in `eggs.ts` (leave `getEgg`, `createEgg`, etc. untouched)
- Other test files
- Any UI files or API routes

## Git workflow

- Branch: from `HEAD`, create `improve/016-fix-createeggs-transaction-and-add-tests`
- Commit message: `fix: resolve createEggs transaction deadlock and add integration tests`
- Do NOT push or open a PR.

## Steps

### Step 1: Fix the transaction deadlock in `createEggs`

In `src/lib/eggs.ts`, replace lines 154-156:

Current:
```tsx
      const id = result.recordset[0].id;
      const egg = await getEgg(id);
      eggs.push(egg!);
```

Replace with (inline the egg fetch using the same transaction connection):
```tsx
      const id = result.recordset[0].id;
      const eggResult = await transaction
        .request()
        .input("id", sql.Int, id)
        .query(`${EGG_SELECT_SQL} WHERE e.id = @id`);
      const egg = (eggResult.recordset[0] as Egg) || null;
      eggs.push(egg!);
```

**Verify**: Run this inline script to confirm `createEggs` no longer hangs:
```bash
npx tsx -e "
import { getPool } from './src/lib/db';
import { createEggs, listEggs } from './src/lib/eggs';
import { createChicken, listChickens } from './src/lib/chickens';

async function main() {
  const pool = await getPool();
  let hens = await listChickens();
  let hen = hens.find(h => h.name === 'AdHoc Fix Verify');
  if (!hen) hen = await createChicken({ name: 'AdHoc Fix Verify', sex: 'Hen' });

  const result = await createEggs([{
    chicken_id: hen.id, weight: 55.00, date: '2026-07-15', recorded_by: 'test@example.com'
  }]);
  console.log('eggs:', result.eggs.length, 'warnings:', result.warnings.length);
  console.log('PASS: createEggs returned', JSON.stringify(result.eggs[0]));

  await pool.close();
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
" 2>&1
```

Expected: "PASS: createEggs returned" with egg details, exits 0. If this hangs or fails, stop and report.

### Step 2: Add `createEggs` to the import

In `tests/eggs.integration.test.ts`, update the import from `@/lib/eggs` (lines 2-12):

Add `createEggs` to the named imports, and add `type CreateEggInput, type CreateEggWarning`:

```tsx
import {
  createEgg,
  createEggs,
  listEggs,
  getEgg,
  updateEgg,
  deleteEgg,
  checkDuplicate,
  getLayingContext,
  getLastUsedChicken,
  type Egg,
  type CreateEggInput,
  type CreateEggWarning,
} from "@/lib/eggs";
```

**Verify**: `npx jest --config jest.integration.config.ts tests/eggs.integration.test.ts` — at least the existing tests pass (file compiles and runs). There may be no new tests yet, but no import errors.

### Step 3: Add the "Batch Create (createEggs)" describe block

Insert the following block **after line 398** (the closing `});` of the "Edit/delete authorization" describe block, before the "Last Used Chicken" describe block:

```tsx
describe("Batch Create (createEggs)", () => {
  it("creates multiple eggs in a batch", async () => {
    const hen1 = await ensureHen("Batch Create Hen 1");
    const hen2 = await ensureHen("Batch Create Hen 2");

    const result = await createEggs([
      {
        chicken_id: hen1.id,
        weight: 55.00,
        date: "2026-07-10",
        recorded_by: RECORDED_BY,
      },
      {
        chicken_id: hen2.id,
        weight: 60.00,
        date: "2026-07-10",
        recorded_by: RECORDED_BY,
      },
    ]);

    expect(result.eggs.length).toBe(2);
    expect(result.warnings.length).toBe(2);
    expect(result.eggs[0].chicken_id).toBe(hen1.id);
    expect(result.eggs[0].weight).toBe(55.00);
    expect(result.eggs[0].date).toBe("2026-07-10");
    expect(result.eggs[1].chicken_id).toBe(hen2.id);
    expect(result.eggs[1].weight).toBe(60.00);
    expect(result.eggs[1].date).toBe("2026-07-10");
  }, 15000);

  it("returns warnings per-entry for duplicate dates", async () => {
    const hen = await ensureHen("Batch Duplicate Hen");

    await createEgg({
      chicken_id: hen.id,
      weight: 55.00,
      date: "2026-07-11",
      recorded_by: RECORDED_BY,
    });

    const result = await createEggs([
      {
        chicken_id: hen.id,
        weight: 56.00,
        date: "2026-07-11",
        recorded_by: RECORDED_BY,
      },
    ]);

    expect(result.eggs.length).toBe(1);
    expect(result.warnings[0].some((w) => w.type === "duplicate_date")).toBe(true);
    expect(result.eggs[0].weight).toBe(56.00);
  }, 15000);

  it("returns warnings per-entry for out-of-range weight", async () => {
    const hen = await ensureHen("Batch Weight Hen");

    const result = await createEggs([
      {
        chicken_id: hen.id,
        weight: 15.00,
        date: "2026-07-12",
        recorded_by: RECORDED_BY,
      },
    ]);

    expect(result.eggs.length).toBe(1);
    expect(result.warnings[0].some((w) => w.type === "weight_out_of_range")).toBe(true);
    expect(result.eggs[0].weight).toBe(15.00);
  }, 15000);

  it("overrideDuplicate=true suppresses duplicate warnings", async () => {
    const hen = await ensureHen("Batch Override Hen");

    await createEgg({
      chicken_id: hen.id,
      weight: 55.00,
      date: "2026-07-13",
      recorded_by: RECORDED_BY,
    });

    const result = await createEggs(
      [
        {
          chicken_id: hen.id,
          weight: 56.00,
          date: "2026-07-13",
          recorded_by: RECORDED_BY,
        },
      ],
      true
    );

    expect(result.eggs.length).toBe(1);
    expect(result.warnings[0].some((w) => w.type === "duplicate_date")).toBe(false);
  }, 15000);

  it("returns empty arrays for empty input", async () => {
    const result = await createEggs([]);

    expect(result.eggs.length).toBe(0);
    expect(result.warnings.length).toBe(0);
  }, 15000);

  it("batch rolls back on error", async () => {
    const hen1 = await ensureHen("Batch Rollback Hen 1");
    const hen2 = await ensureHen("Batch Rollback Hen 2");

    await expect(
      createEggs([
        {
          chicken_id: hen1.id,
          weight: 55.00,
          date: "2026-07-14",
          recorded_by: RECORDED_BY,
        },
        {
          chicken_id: 999999,
          weight: 60.00,
          date: "2026-07-14",
          recorded_by: RECORDED_BY,
        },
      ])
    ).rejects.toThrow();

    const eggs = await listEggs({ chicken_id: hen1.id });
    expect(eggs.length).toBe(0);
  }, 15000);
});
```

**Verify**: `npx jest --config jest.integration.config.ts tests/eggs.integration.test.ts` → all 32 tests pass (26 existing + 6 new). The batch tests should each complete in under 15 seconds now (expected: 50-200ms each like the existing tests).

## Test plan

The new tests ARE the test plan. See Step 3 for all 6 test cases:
1. Batch creates multiple eggs
2. Duplicate date warnings
3. Out-of-range weight warnings
4. OverrideDuplicate flag
5. Empty input
6. Transaction rollback on FK error

## Done criteria

- [ ] `npm run build` exits 0
- [ ] Step 1's inline verification script exits 0 with "PASS: createEggs returned"
- [ ] `npx jest --config jest.integration.config.ts tests/eggs.integration.test.ts` exits 0, all 32 tests pass
- [ ] No files outside `src/lib/eggs.ts` and `tests/eggs.integration.test.ts` are modified
- [ ] The batch tests each complete in under 15s (expected < 1s per test)

## STOP conditions

Stop and report back if:

- The `createEggs` function signature or location has changed from the excerpts above.
- The inline verification script in Step 1 hangs (the deadlock should be fixed) or fails.
- An existing test in `tests/eggs.integration.test.ts` fails (report which one — pre-existing issue).
- The test database is not available and tests fail for environmental reasons.
- `EGG_SELECT_SQL` is not accessible in `createEggs` function scope (it's defined at module level in the same file — if missing, stop).

## Maintenance notes

- `createEggs` is a batch function with transactional semantics. Any modification to the query logic inside the loop must keep all queries on `transaction.request()`, never `pool.request()` or `getPool()`, to avoid the same deadlock pattern.
- If the schema of `eggs` or `chickens` changes, the `EGG_SELECT_SQL` constant must be updated to match.
- The "rolls back on error" test relies on `listEggs` confirming no eggs exist for the hen — if transaction rollback behaviour changes (e.g. partial commits), update this test.
