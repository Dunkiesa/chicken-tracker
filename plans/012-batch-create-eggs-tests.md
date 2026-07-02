# Plan 012: Add integration tests for `createEggs` batch function

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 3ccb427..HEAD -- tests/ src/lib/eggs.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `3ccb427`, 2026-07-02

## Why this matters

The `createEggs` function in `src/lib/eggs.ts` is the primary egg entry path now (the Bulk Log page submits all eggs via this batch function). Despite being the critical path, it has zero test coverage. The existing tests only cover `createEgg` (single-egg). Without coverage, regressions in the batch submission logic, transaction handling, duplicate detection, and weight validation won't be caught.

## Current state

`src/lib/eggs.ts:99-166` — the `createEggs` function:
```tsx
export async function createEggs(
  inputs: CreateEggInput[],
  overrideDuplicate = false
): Promise<{ eggs: Egg[]; warnings: CreateEggWarning[][] }> {
  if (inputs.length === 0) {
    return { eggs: [], warnings: [] };
  }

  const pool = await getPool();
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    const eggs: Egg[] = [];
    const warnings: CreateEggWarning[][] = [];

    for (const input of inputs) {
      const eggWarnings: CreateEggWarning[] = [];

      if (!overrideDuplicate) {
        const existing = await transaction
          .request()
          .input("chicken_id", sql.Int, input.chicken_id)
          .input("date", sql.Date, input.date)
          .query("SELECT id FROM eggs WHERE chicken_id = @chicken_id AND date = @date");

        if (existing.recordset.length > 0) {
          eggWarnings.push({
            type: "duplicate_date",
            message: `${input.chicken_id} already has an egg logged for ${input.date}`,
          });
        }
      }

      if (input.weight < 20 || input.weight > 200) {
        eggWarnings.push({
          type: "weight_out_of_range",
          message: `Weight ${input.weight}g is outside the typical range of 20–200g`,
        });
      }

      const result = await transaction
        .request()
        .input("chicken_id", sql.Int, input.chicken_id)
        .input("weight", sql.Decimal(5, 2), input.weight)
        .input("date", sql.Date, input.date)
        .input("recorded_by", sql.NVarChar(255), input.recorded_by)
        .query(`
          INSERT INTO eggs (chicken_id, weight, date, recorded_by)
          OUTPUT INSERTED.id
          VALUES (@chicken_id, @weight, @date, @recorded_by)
        `);

      const id = result.recordset[0].id;
      const egg = await getEgg(id);
      eggs.push(egg!);
      warnings.push(eggWarnings);
    }

    await transaction.commit();
    return { eggs, warnings };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

`src/lib/eggs.ts` exports:
```tsx
export type CreateEggInput = {
  chicken_id: number;
  weight: number;
  date: string;
  recorded_by: string;
};

export type CreateEggWarning = {
  type: "duplicate_date" | "weight_out_of_range";
  message: string;
};
```

Existing test pattern in `tests/eggs.integration.test.ts`:
- Uses `ensureHen(name)` helper to get-or-create a hen chicken
- Uses `RECORDED_BY = "test@example.com"` constant
- Tests use `beforeAll` (ensureDatabase, runMigrations) and `afterAll` (closePool)
- Test naming: `describe("Category", () => { it("does something", async () => { ... }, 15000); })`

## Commands you will need

| Purpose              | Command                              | Expected on success       |
|----------------------|--------------------------------------|---------------------------|
| Build                | `npm run build`                      | exit 0                    |
| Integration tests    | `npm run test:integration`           | all tests pass            |
| Run single test file | `npx jest --config jest.integration.config.ts tests/eggs.integration.test.ts` | all tests pass |

## Scope

**In scope**:
- `tests/eggs.integration.test.ts` — add new `describe` block

**Out of scope**:
- `src/` files (no library changes)
- Other test files

## Git workflow

- Branch: from `HEAD` (current `bulkadd`), create `improve/012-batch-create-eggs-tests`
- Commit message style: `test: add createEggs batch integration tests`
- Do NOT push or open a PR.

## Steps

### Step 1: Add `createEggs` to the import

In `tests/eggs.integration.test.ts`, line 2-12, add `createEggs` to the import from `@/lib/eggs`.

**Verify**: `npx jest --config jest.integration.config.ts tests/eggs.integration.test.ts` — at least the existing tests pass. There may be no new tests yet, but the file should compile and run.

### Step 2: Add a `describe("Batch Create (createEggs)", () => { ... })` block

Add it after the "Edit/delete authorization" describe block (after line 398). The new block should contain these test cases:

**Test 1: "creates multiple eggs in a batch"**
- Create two hens via `ensureHen`
- Call `createEggs` with two inputs (different hens, same or different dates)
- Assert `eggs.length === 2`
- Assert each egg has the correct `chicken_id`, `weight`, `date`

**Test 2: "returns warnings per-entry for duplicate dates"**
- Create a hen and log one egg for a date
- Call `createEggs` with an input for the same hen + date
- Assert `warnings[0]` contains a warning of type `"duplicate_date"`
- Assert the egg was still created (batch does not block duplicates, only warns)

**Test 3: "returns warnings per-entry for out-of-range weight"**
- Create a hen
- Call `createEggs` with a weight of `15.00` (below 20g)
- Assert `warnings[0]` contains a warning of type `"weight_out_of_range"`

**Test 4: "overrideDuplicate=true suppresses duplicate warnings"**
- Create a hen and log one egg for a date
- Call `createEggs` with `overrideDuplicate = true` and the same hen + date
- Assert `warnings[0]` is empty or has no `duplicate_date` warning

**Test 5: "returns empty arrays for empty input"**
- Call `createEggs([])`
- Assert `eggs.length === 0` and `warnings.length === 0`

**Test 6: "batch rolls back on error"**
- Create two hens
- Call `createEggs` with one valid input and one with an invalid `chicken_id` (e.g. `999999`)
- Assert the call throws (or returns an error)
- Verify that the valid egg was NOT persisted (query `listEggs`)

Each test should use `15000` timeout like existing tests. Follow the existing pattern of `ensureHen` for test setup.

**Verify**: `npx jest --config jest.integration.config.ts tests/eggs.integration.test.ts` → all tests pass, including the 6 new ones plus all existing tests.

## Test plan

The new tests ARE the test plan. See Step 2 above.

## Done criteria

- [ ] `npm run build` exits 0
- [ ] `npm run test:integration` exits 0 (or `npx jest --config jest.integration.config.ts tests/eggs.integration.test.ts` exits 0)
- [ ] At least 6 new test cases exist in the "Batch Create (createEggs)" describe block
- [ ] All existing tests still pass
- [ ] No files outside `tests/eggs.integration.test.ts` are modified

## STOP conditions

Stop and report back if:

- `createEggs` doesn't exist or its signature has changed from the excerpt above.
- The test database is not available and tests fail for environmental reasons.
- An existing test fails (pre-existing condition — report it).

## Maintenance notes

- If `createEggs` behaviour changes (e.g. starts blocking duplicates instead of warning), update these tests.
- The "rolls back on error" test relies on `listEggs` — if the transaction rolls back correctly, the eggs shouldn't be visible.
