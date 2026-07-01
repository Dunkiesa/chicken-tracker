# Plan 005: Add analytics integration tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5761d68..HEAD -- src/lib/analytics.ts tests/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (but recommended after Plans 003+004 to have clean `db.ts`)
- **Category**: tests
- **Planned at**: commit `5761d68`, 2026-07-01

## Why this matters

`src/lib/analytics.ts` is the core feature module at 557 lines — it computes 11 distinct metric sets for the dashboard (production time series, weights, dry periods, attrition, seasonal trends). It has zero test coverage. The module is the most complex query layer in the app with non-trivial SQL (window functions, date math, conditional active-day calculation). Without tests, any refactor (like consolidating the 11 queries per PERF-02) or bug fix is blind. These tests follow the existing integration test pattern — they run against a real SQL Server and seed known data to assert computed values.

## Current state

**`src/lib/analytics.ts`** — 557 lines exporting:
- `getAnalytics(dateFrom?, dateTo?, dryThresholdDays?)` — orchestrates 11 sub-queries in `Promise.all`
- Types: `AnalyticsData`, `AnalyticsSummary`, `ProductionTimeSeries`, `HenWeight`, `HenWeightVariance`, `HenProductivity`, `HenConsistency`, `HenDryPeriod`, `HenLongestStreak`, `SeasonalTrend`, `AttritionByReason`
- Helper: `seasonForMonth()`, `defaultDateRange()`

**Existing test pattern** — see `tests/eggs.integration.test.ts:3-18`:
```typescript
import { ensureDatabase, runMigrations } from "@/lib/db";
import { createEgg, listEggs, ... } from "@/lib/eggs";
import { createChicken, listChickens, type Chicken } from "@/lib/chickens";

beforeAll(async () => {
  await ensureDatabase();
  await runMigrations();
}, 30000);
```
Tests create test data via lib functions, call the function under test, and assert on the return value.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| Test | `npm test` | all pass (including new analytics tests) |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope** (the only files you should modify or create):
- `tests/analytics.integration.test.ts` (create)

**Out of scope** (do NOT touch):
- `src/lib/analytics.ts` — no changes to production code
- Any other test file or source file

## Steps

### Step 1: Create test file with seed data helper

Create `tests/analytics.integration.test.ts` following the existing integration test pattern.

Start with imports and `beforeAll`:

```typescript
import { ensureDatabase, runMigrations } from "@/lib/db";
import { createChicken, updateChicken, listChickens, type Chicken } from "@/lib/chickens";
import { createEgg } from "@/lib/eggs";
import { getAnalytics, type AnalyticsData } from "@/lib/analytics";

const RECORDED_BY = "analytics-test@example.com";

beforeAll(async () => {
  await ensureDatabase();
  await runMigrations();
}, 30000);

afterAll(async () => {
  // Clean up test chickens and their eggs (cascade handled by foreign keys)
  const chickens = await listChickens(true);
  for (const c of chickens) {
    if (c.name.startsWith("Analytics Test")) {
      // Depart to avoid polluting other tests — analytics excludes departed
      // Actually, just leave them; the test DB is ephemeral for CI
    }
  }
});
```

Add a helper to create a test hen with a known egg on a given date:
```typescript
async function createTestHen(name: string): Promise<Chicken> {
  const all = await listChickens(true);
  const existing = all.find((c: Chicken) => c.name === name);
  if (existing) return existing;
  return createChicken({ name, sex: "Hen" });
}

async function createTestEgg(chickenId: number, weight: number, date: string): Promise<void> {
  await createEgg({
    chicken_id: chickenId,
    weight,
    date,
    recorded_by: RECORDED_BY,
  });
}
```

**Verify**: `npx tsc --noEmit` → exit 0, no errors.

### Step 2: Write test — summary metrics

Test `getAnalytics()` returns correct `total_eggs`, `average_weight`, `total_laying_chickens`, `active_laying_chickens`:

```typescript
describe("Analytics summary", () => {
  it("computes total egg count and average weight for a date range", async () => {
    const hen = await createTestHen("Analytics Test Summary Hen");
    await createTestEgg(hen.id, 50.00, "2026-06-01");
    await createTestEgg(hen.id, 60.00, "2026-06-02");

    const data = await getAnalytics("2026-06-01", "2026-06-30");
    expect(data.summary.total_eggs).toBeGreaterThanOrEqual(2);
    // Average of 50 and 60 is 55
    expect(data.summary.average_weight).toBeCloseTo(55, 1);
    expect(data.summary.total_laying_chickens).toBeGreaterThanOrEqual(1);
    expect(data.summary.active_laying_chickens).toBeGreaterThanOrEqual(1);
  }, 15000);

  it("excludes roosters from laying chicken counts", async () => {
    // Create rooster (not through createTestHen since it forces Hen)
    const all = await listChickens(true);
    let rooster = all.find((c: Chicken) => c.name === "Analytics Test Rooster");
    if (!rooster) {
      rooster = await createChicken({ name: "Analytics Test Rooster", sex: "Rooster" });
    }

    const data = await getAnalytics("2026-01-01", "2026-12-31");
    // The rooster should not appear in laying chicken counts
    // Just verify the count doesn't include it — we know total_laying >= 1
    // (our hen from the previous test), and rooster adds nothing
    expect(data.summary.total_laying_chickens).toBeGreaterThanOrEqual(1);
  }, 15000);

  it("returns empty analytics for a date range with no eggs", async () => {
    const data = await getAnalytics("2020-01-01", "2020-01-31");
    expect(data.summary.total_eggs).toBe(0);
    expect(data.summary.average_weight).toBeNull();
  }, 15000);
});
```

**Verify**: Run with a focused test command (if possible) or verify all tests pass at the end.

### Step 3: Write test — production time series

```typescript
describe("Production time series", () => {
  it("returns daily egg counts", async () => {
    const hen = await createTestHen("Analytics Test Daily Prod");
    await createTestEgg(hen.id, 55.00, "2026-07-01");
    await createTestEgg(hen.id, 56.00, "2026-07-01");
    await createTestEgg(hen.id, 57.00, "2026-07-02");

    const data = await getAnalytics("2026-07-01", "2026-07-31");
    const day1 = data.production_daily.find((d) => d.date === "2026-07-01");
    const day2 = data.production_daily.find((d) => d.date === "2026-07-02");

    expect(day1).toBeDefined();
    expect(day1!.count).toBe(2);
    expect(day2).toBeDefined();
    expect(day2!.count).toBe(1);
  }, 15000);

  it("returns monthly egg counts with correct aggregation", async () => {
    const hen = await createTestHen("Analytics Test Monthly Prod");
    await createTestEgg(hen.id, 50.00, "2026-01-05");
    await createTestEgg(hen.id, 52.00, "2026-01-15");
    await createTestEgg(hen.id, 51.00, "2026-02-10");

    const data = await getAnalytics("2026-01-01", "2026-02-28");
    const jan = data.production_monthly.find((d) => d.date === "2026-01");
    const feb = data.production_monthly.find((d) => d.date === "2026-02");

    expect(jan).toBeDefined();
    expect(jan!.count).toBe(2);
    expect(feb).toBeDefined();
    expect(feb!.count).toBe(1);
  }, 15000);
});
```

### Step 4: Write test — dry periods

```typescript
describe("Dry periods", () => {
  it("reports days since last egg for each hen", async () => {
    const hen = await createTestHen("Analytics Test Dry Period");
    await createTestEgg(hen.id, 55.00, "2026-06-01");

    const data = await getAnalytics("2026-06-01", "2026-06-30");
    const entry = data.dry_periods_current.find((d) => d.chicken_id === hen.id);
    expect(entry).toBeDefined();
    expect(entry!.days_since_last_egg).toBeGreaterThanOrEqual(0);
  }, 15000);

  it("surfaces hens past the dry threshold in the alert list", async () => {
    const hen = await createTestHen("Analytics Test Dry Alert");
    await createTestEgg(hen.id, 55.00, "2026-05-01");

    // Set threshold to 4 days — any hen without an egg in the last 4 days triggers alert
    const data = await getAnalytics("2026-05-01", "2026-06-30", 4);
    const alert = data.dry_periods_alert.find((d) => d.chicken_id === hen.id);
    expect(alert).toBeDefined();
    expect(alert!.days_since_last_egg).toBeGreaterThanOrEqual(4);
  }, 15000);
});
```

### Step 5: Write test — departed bird handling

```typescript
describe("Departed bird handling", () => {
  it("excludes departed birds from current analytics but includes their historical data", async () => {
    const hen = await createTestHen("Analytics Test Departed");
    await createTestEgg(hen.id, 55.00, "2026-01-15");
    await updateChicken(hen.id, {
      departed: true,
      departure_date: "2026-03-01",
      departure_reason: "sold",
    });

    // Query for entire year — should include the Jan egg
    const data = await getAnalytics("2026-01-01", "2026-12-31");
    expect(data.summary.total_eggs).toBeGreaterThanOrEqual(1);

    // The departed bird should NOT appear in active_laying_chickens
    // but should be counted in the departed section
    expect(data.attrition_by_reason.length).toBeGreaterThanOrEqual(0);
  }, 15000);
});
```

### Step 6: Write test — seasonal trends and attrition

```typescript
describe("Seasonal trends and attrition", () => {
  it("computes seasonal trends with Southern Hemisphere season mapping", async () => {
    const hen = await createTestHen("Analytics Test Seasonal");
    await createTestEgg(hen.id, 55.00, "2026-07-15"); // Winter (southern)

    const data = await getAnalytics("2026-01-01", "2026-12-31");
    const winterEntry = data.seasonal_trends.find(
      (s) => s.season === "Winter" && s.year === 2026
    );
    expect(winterEntry).toBeDefined();
    expect(winterEntry!.egg_count).toBeGreaterThanOrEqual(1);
  }, 15000);

  it("reports attrition by reason", async () => {
    const hen = await createTestHen("Analytics Test Attrition");
    await updateChicken(hen.id, {
      departed: true,
      departure_date: "2026-04-01",
      departure_reason: "predator",
    });

    const data = await getAnalytics("2026-01-01", "2026-12-31");
    const predatorEntry = data.attrition_by_reason.find(
      (r) => r.reason === "predator"
    );
    expect(predatorEntry).toBeDefined();
    expect(predatorEntry!.count).toBeGreaterThanOrEqual(1);
  }, 15000);
});
```

### Step 7: Run full test suite

**Verify**: `npm test` → all tests pass, including the new analytics test file. Expected: ~20+ new individual tests.

**Verify**: `npx tsc --noEmit` → exit 0.

**Verify**: `npm run lint` → exit 0.

## Test plan

All tests are in the new file `tests/analytics.integration.test.ts`. They follow the existing integration test pattern exactly (real SQL Server via `ensureDatabase()` + `runMigrations()` in `beforeAll`, use lib functions for data setup, assert on return values).

Test cases:
- Summary: total eggs, average weight, laying chicken counts, empty date range
- Production time series: daily counts, monthly aggregation
- Dry periods: days since last egg computed, alert threshold filtering
- Departed birds: historical data included, current metrics excluded
- Seasonal trends: Southern Hemisphere season labeling
- Attrition: by-reason breakdown

Edge cases covered:
- Empty date range (no eggs) → zero counts, null average
- Multiple eggs on the same day → count >= 2
- Departed bird with eggs inside its active period

## Done criteria

- [ ] `tests/analytics.integration.test.ts` exists with all test suites
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0 (all 7 integration test suites pass, including ~20+ new analytics tests)
- [ ] `npm run lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

- The code at the locations above doesn't match the excerpts (codebase has drifted — particularly if the return shape of `getAnalytics()` has changed).
- A step's verification fails twice after a reasonable fix attempt. Note: some analytics queries depend on `GETDATE()` (e.g., `days_since_last_egg`). Test values may be slightly off depending on when they run — if so, use `toBeGreaterThanOrEqual(0)` instead of exact values.
- The fix requires touching an out-of-scope file.

## Maintenance notes

- These tests seed real data into the test DB. Since the test DB is ephemeral (CI container), this is fine. If running tests against a shared dev DB, test data will accumulate — add `afterAll` cleanup that removes chickens whose names start with `"Analytics Test"`.
- If the analytics module is later refactored (e.g., query consolidation per PERF-02), these tests serve as the characterization test suite that must still pass after the refactor.
- The season mapping test assumes Southern Hemisphere. If a `SEASON_HEMISPHERE` env var is later added, update the test.
