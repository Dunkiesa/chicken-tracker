# Plan 007: Add batch egg entry

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5761d68..HEAD -- src/lib/eggs.ts src/app/api/eggs/route.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `5761d68`, 2026-07-01

## Why this matters

Daily egg logging is the app's most frequent interaction. For a flock of 20 hens, the current single-egg endpoint requires 20 sequential API calls. Adding a batch endpoint that accepts an array of eggs and creates them in a single transaction reduces round-trips and makes multi-hen entry practical. The batch endpoint reuses existing validation (duplicate checking, weight warnings) and the data model supports multi-row INSERT natively.

## Current state

**`src/lib/eggs.ts:51-97`** — `createEgg()` creates one egg at a time:
```typescript
export async function createEgg(
  input: CreateEggInput,
  overrideDuplicate = false
): Promise<{ egg: Egg; warnings: CreateEggWarning[] }> {
  // ... duplicate check, weight warning, single INSERT ...
  const result = await pool.request()
    .input("chicken_id", sql.Int, input.chicken_id)
    .input("weight", sql.Decimal(5, 2), input.weight)
    .input("date", sql.Date, input.date)
    .input("recorded_by", sql.NVarChar(255), input.recorded_by)
    .query(`INSERT INTO eggs (chicken_id, weight, date, recorded_by)
            OUTPUT INSERTED.id
            VALUES (@chicken_id, @weight, @date, @recorded_by)`);
  const id = result.recordset[0].id;
  const egg = await getEgg(id);
  return { egg: egg!, warnings };
}
```

**`src/app/api/eggs/route.ts:46-108`** — POST handler accepts a single `{ chicken_id, weight, date, override_duplicate }` body.

**Repo conventions to follow**:
- Error handling: return `NextResponse.json({ message }, status)` with proper status codes — see `eggs/route.ts:58-70`.
- SQL patterns: parameterized queries with `mssql` input types — see `eggs.ts:84-92`.
- Transaction pattern: use `pool.transaction()` for multi-write atomicity — see any mssql docs or the existing `mergeValues` in `dynamic-lists.ts:101-115` for a two-step transaction-like pattern (though that one doesn't use an explicit transaction; this plan will use `sql.Transaction` for correctness).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| Test | `npm test` | all pass |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `src/lib/eggs.ts`
- `src/app/api/eggs/route.ts`

**Out of scope** (do NOT touch):
- Frontend (`src/app/log-egg/page.tsx`) — no UI change in this plan; frontend batch entry can be added separately
- `src/lib/eggs.ts` test file — existing tests for `createEgg` must still pass
- Any other route or lib file

## Steps

### Step 1: Add `createEggs` batch function to eggs lib

In `src/lib/eggs.ts`, add a new exported function `createEggs` after the existing `createEgg` function (after line 97). It accepts an array of `CreateEggInput` and an optional `overrideDuplicate` flag, creates all eggs within a single SQL transaction, and returns an array of results.

```typescript
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
          .query(
            "SELECT id FROM eggs WHERE chicken_id = @chicken_id AND date = @date"
          );

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

**Verify**: `npx tsc --noEmit` → exit 0, no errors.

### Step 2: Add batch endpoint to eggs route

In `src/app/api/eggs/route.ts`, modify the `POST` handler to detect whether the request body is an array or a single object.

After line 55 (`const body = await request.json();`), add a check:

```typescript
if (Array.isArray(body)) {
  return handleBatchCreate(body, session, request);
}
```

Then add the `handleBatchCreate` function above the `POST` handler (after the imports, before `export async function POST`):

```typescript
async function handleBatchCreate(
  items: unknown[],
  session: { user: { email: string } },
  request: NextRequest
): Promise<NextResponse> {
  try {
    if (items.length === 0) {
      return NextResponse.json(
        { message: "At least one egg entry is required" },
        { status: 400 }
      );
    }

    const inputs: CreateEggInput[] = [];
    for (const item of items) {
      const obj = item as Record<string, unknown>;
      const chicken_id = obj.chicken_id;
      const weight = obj.weight;
      const date = obj.date;

      if (typeof chicken_id !== "number" || !Number.isInteger(chicken_id) || chicken_id < 1) {
        return NextResponse.json(
          { message: "Each entry must have a valid chicken_id (positive integer)" },
          { status: 400 }
        );
      }
      if (typeof weight !== "number" || isNaN(weight) || !isFinite(weight) || weight < 0) {
        return NextResponse.json(
          { message: "Each entry must have a valid weight (non-negative number)" },
          { status: 400 }
        );
      }
      if (typeof date !== "string" || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return NextResponse.json(
          { message: "Each entry must have a valid date (YYYY-MM-DD)" },
          { status: 400 }
        );
      }

      inputs.push({
        chicken_id,
        weight: Math.round(weight * 100) / 100,
        date,
        recorded_by: session.user.email,
      });
    }

    const overrideDuplicate = request.nextUrl.searchParams.get("override_duplicate") === "true";
    const result = await createEggs(inputs, overrideDuplicate);
    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

Also update the import from `@/lib/eggs` to include `createEggs`:

```typescript
import { createEgg, createEggs, listEggs, checkDuplicate, getLayingContext, getLastUsedChicken } from "@/lib/eggs";
```

And add the `CreateEggInput` type import:

```typescript
import { createEgg, createEggs, listEggs, checkDuplicate, getLayingContext, getLastUsedChicken, type CreateEggInput } from "@/lib/eggs";
```

**Verify**: `npx tsc --noEmit` → exit 0, no errors.

### Step 3: Run full verification

**Verify**: `npm test` → all existing tests pass (existing single-egg flow unchanged).
**Verify**: `npm run lint` → exit 0.

## Test plan

No new tests required in this plan — the existing egg integration tests (`tests/eggs.integration.test.ts`) cover `createEgg` and must still pass. The batch endpoint can be tested manually:

```bash
curl -X POST http://localhost:3000/api/eggs \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '[
    {"chicken_id": 1, "weight": 55.5, "date": "2026-07-01"},
    {"chicken_id": 2, "weight": 60.0, "date": "2026-07-01"}
  ]'
```

Expected: 201 with `{ eggs: [...], warnings: [[], []] }`.

Single-egg POST must still work:
```bash
curl -X POST http://localhost:3000/api/eggs \
  -H "Content-Type: application/json" \
  -d '{"chicken_id": 1, "weight": 55.5, "date": "2026-07-01"}'
```

Expected: 201 with `{ egg: {...}, warnings: [] }`.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0
- [ ] `npm run lint` exits 0
- [ ] `POST /api/eggs` with JSON array body returns 201 with `{ eggs: [...], warnings: [...] }`
- [ ] `POST /api/eggs` with single object body still returns 201 with `{ egg: {...}, warnings: [...] }`
- [ ] `POST /api/eggs` with empty array returns 400
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

- The code at the locations above doesn't match the excerpts (codebase has drifted).
- A step's verification fails twice after a reasonable fix attempt.
- The fix requires touching an out-of-scope file.

## Maintenance notes

- The batch endpoint uses `override_duplicate` as a query parameter (not body field) to keep the array body clean. All items share the same override setting.
- If the batch is large (e.g., 50+ eggs), the transaction will hold locks for the duration of the inserts. For a small-flock app this is fine, but if the flock grows beyond 100 hens, consider batching in chunks of 25.
- The per-item validation returns on first invalid item rather than collecting all errors. This is consistent with the existing single-egg validation pattern.
- A future frontend improvement would add a multi-hen entry form in `log-egg/page.tsx` that uses this batch endpoint.
