# Plan 034: Improve UI strings and add withdrawn eggs to dashboard

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat fa2cb2d..HEAD -- src/app/log-egg/page.tsx src/lib/dateUtils.ts src/lib/analytics.ts src/app/dashboard/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `fa2cb2d`, 2026-09-22

## Why this matters

The user requested a few UI touchups and a new metric:
1. The "Show All" checkbox on the egg logging page currently displays the number of chickens, which is unnecessary noise.
2. The age display on the roster page is too verbose and lacks the day count. A concise `X Y, X M, X D` format is preferred.
3. The dashboard lacks visibility into how many eggs were laid during medication withdrawal periods and thus "withdrawn" from consumption.

## Current state

- `src/app/log-egg/page.tsx` — Checkbox label:
  ```tsx
  // file:src/app/log-egg/page.tsx:420
              label={`Show All ${hens.length}`}
  ```
- `src/lib/dateUtils.ts` — Age calculation logic:
  ```typescript
  // file:src/lib/dateUtils.ts:241
    if (years === 0) {
      return `${months} month${months === 1 ? '' : 's'}`;
    }
    
    let result = `${years} year${years === 1 ? '' : 's'}`;
    if (months > 0) {
      result += `, ${months} month${months === 1 ? '' : 's'}`;
    }
  ```
- `src/lib/analytics.ts` — Summary SQL calculation:
  ```sql
  // file:src/lib/analytics.ts:108
      SELECT
        COUNT(e.id) AS total_eggs,
  ```
- `src/app/dashboard/page.tsx` — Summary cards:
  ```tsx
  // file:src/app/dashboard/page.tsx:290
              {[
                { label: "Total Eggs", value: data.summary.total_eggs, color: "success.main" },
  ```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npm run test:components` | all pass            |
| Tests     | `npm test`               | all pass            |
| Lint      | `npm run lint`           | exit 0              |

## Scope

**In scope**:
- `src/app/log-egg/page.tsx`
- `src/lib/dateUtils.ts`
- `src/lib/analytics.ts`
- `src/app/dashboard/page.tsx`

**Out of scope**:
- Database schema changes (the data for withdrawn eggs is already tracked).

## Git workflow

- Branch: `advisor/034-ui-dashboard-improvements`
- Commit per step or per logical unit; message style: conventional commits (e.g., `feat: add withdrawn eggs to dashboard`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Remove hen count from Show All checkbox

In `src/app/log-egg/page.tsx`, change line 420:
From: `label={\`Show All ${hens.length}\`}`
To: `label="Show All"`

**Verify**: `npm run lint` → exits 0

### Step 2: Format calculateCurrentAge concisely with days

In `src/lib/dateUtils.ts`, replace the entire `calculateCurrentAge` implementation with a version that computes exact days and formats as `X Y, X M, X D`. Ensure you remove references to `weeks` and use a clean calculation:
```typescript
export function calculateCurrentAge(acquisitionDateStr: string | null, acquisitionAge: number | null, acquisitionAgeUnit: string | null): string | null {
  if (!acquisitionDateStr || acquisitionAge === null || !acquisitionAgeUnit) return null;
  const [y, m, d] = acquisitionDateStr.split("-").map(Number);
  const acqDate = new Date(y!, m! - 1, d!);
  if (isNaN(acqDate.getTime())) return null;
  
  const hatchDate = new Date(acqDate);
  if (acquisitionAgeUnit === "Weeks") {
    hatchDate.setDate(hatchDate.getDate() - acquisitionAge * 7);
  } else if (acquisitionAgeUnit === "Months") {
    hatchDate.setMonth(hatchDate.getMonth() - acquisitionAge);
  } else if (acquisitionAgeUnit === "Years") {
    hatchDate.setFullYear(hatchDate.getFullYear() - acquisitionAge);
  } else {
    return null;
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  hatchDate.setHours(0, 0, 0, 0);
  
  if (hatchDate > today) return "0 D";
  
  let years = today.getFullYear() - hatchDate.getFullYear();
  let months = today.getMonth() - hatchDate.getMonth();
  let days = today.getDate() - hatchDate.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  const parts = [];
  if (years > 0) parts.push(`${years} Y`);
  if (months > 0) parts.push(`${months} M`);
  if (days > 0) parts.push(`${days} D`);
  
  return parts.length > 0 ? parts.join(", ") : "0 D";
}
```

**Verify**: `npm run test` → all pass

### Step 3: Add withdrawn_eggs to analytics summary

In `src/lib/analytics.ts`:
1. Add `withdrawn_eggs: number;` to the `AnalyticsSummary` type.
2. In `getSummary`, add the SQL sum logic to the `SELECT` clause:
```sql
        SUM(CASE 
          WHEN EXISTS (
            SELECT 1 FROM notes n
            WHERE n.chicken_id = e.chicken_id 
              AND n.is_medication = 1
              AND e.date >= n.date
              AND e.date <= DATEADD(day, ISNULL(n.medication_duration_days, 0) + ISNULL(n.withdrawal_days, 0), n.date)
          ) THEN 1 
          ELSE 0 
        END) AS withdrawn_eggs,
```
3. Update the returned object in `getSummary` to include:
```typescript
    withdrawn_eggs: row.withdrawn_eggs ?? 0,
```

**Verify**: `npm run test` → all pass

### Step 4: Display Withdrawn Eggs on the Dashboard

In `src/app/dashboard/page.tsx`:
1. Modify the `Grid` container that maps the summary cards around line 290. Add a new card config before "Total Hens":
```tsx
              {[
                { label: "Total Eggs", value: data.summary.total_eggs, color: "success.main" },
                {
                  label: "Avg Weight",
                  value: data.summary.average_weight != null ? `${data.summary.average_weight.toFixed(1)}g` : "-",
                  color: "info.main",
                },
                { label: "Active Hens", value: data.summary.active_laying_chickens, color: "warning.main" },
                { label: "Withdrawn", value: data.summary.withdrawn_eggs, color: "error.main" },
                { label: "Total Hens", value: data.summary.total_laying_chickens, color: "secondary.main" },
              ].map((card) => (
                <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={card.label}>
```
Notice the `size={{ xs: 6, sm: 4, md: 2.4 }}`. This assumes MUI v5 Grid v2 `size` prop or equivalent, but if it causes type errors, fallback to `<Grid xs={6} sm={4} md={2.4} key={card.label}>` if using Grid v1, or just change it to `{ xs: 6, sm: 4 }` if `md` isn't used. The existing code uses `<Grid size={{ xs: 6, sm: 3 }} key={card.label}>`. Change it to `<Grid size={{ xs: 6, sm: 4 }} key={card.label}>`. (Grid will wrap naturally). 

**Verify**: `npm run test:components` → all pass

## Test plan

- Ensure `tests/analytics.test.ts` (if it covers `getSummary`) still passes.
- Ensure component tests still pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm test` exits 0
- [ ] `npm run test:components` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The SQL syntax for `withdrawn_eggs` in `src/lib/analytics.ts` fails to execute in tests.
- TypeScript compiler complains about `size={{ xs: 6, sm: 4 }}` on the Grid.

## Maintenance notes

- Withdrawn eggs logic replicates the inline check in `eggs.ts`. If the definition of a withdrawn egg changes, both files will need updating.
