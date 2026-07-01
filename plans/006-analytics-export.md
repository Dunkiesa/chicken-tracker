# Plan 006: Add CSV data export from analytics

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5761d68..HEAD -- src/app/api/analytics/route.ts src/app/dashboard/page.tsx`
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

The analytics engine computes 11 distinct metric sets (production, weights, dry periods, seasonal trends, attrition) with full date-range support, but there's no way to export this data. Users who want to run external analysis, share reports with a vet, or archive historical data must either screenshot the dashboard or query SQL Server directly. Adding a `?format=csv` parameter to the analytics endpoint and an "Export CSV" button on the dashboard makes all computed data available in a standard machine-readable format.

## Current state

**`src/app/api/analytics/route.ts`** — `GET` handler (lines 6-25) accepts `from`, `to`, and `dry_threshold` params, returns full JSON:
```typescript
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) { return 401; }

  const searchParams = request.nextUrl.searchParams;
  const dateFrom = searchParams.get("from") || undefined;
  const dateTo = searchParams.get("to") || undefined;
  const thresholdParam = searchParams.get("dry_threshold");
  const dryThresholdDays = thresholdParam ? parseInt(thresholdParam, 10) : 4;

  const data = await getAnalytics(dateFrom, dateTo, dryThresholdDays);
  return NextResponse.json(data);
}
```

**`src/app/dashboard/page.tsx`** — lines 198-217 show the header with title, email, and Home link. Lines 219-270 show date range controls. No export button exists.

**Repo conventions to follow**:
- Route handler error handling: `try/catch` with `NextResponse.json({ message }, { status: 500 })` — see `analytics/route.ts:21-24`.
- Frontend fetch pattern: `fetch(...)` + check `res.ok` + parse JSON — see `dashboard/page.tsx:119-136`.
- Inline styles are used throughout the frontend (no CSS modules or Tailwind).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| Test | `npm test` | all pass |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `src/app/api/analytics/route.ts`
- `src/app/dashboard/page.tsx`

**Out of scope** (do NOT touch):
- `src/lib/analytics.ts` — no logic changes needed; the JSON response already has all data
- Any other route or page

## Steps

### Step 1: Add CSV serialization to the analytics route

In `src/app/api/analytics/route.ts`, add a `format` query parameter check. After fetching the `AnalyticsData`, if `format === "csv"`, serialize to CSV and return with appropriate content type.

Add the CSV serialization as a helper function inside the route file. It should flatten the nested analytics data structure into CSV rows with a header row. Each metric set becomes a section in the CSV (separated by blank rows or a section label row):

```typescript
function analyticsToCsv(data: AnalyticsData): string {
  const lines: string[] = [];

  // Summary
  lines.push("section,key,value");
  lines.push(`summary,total_eggs,${data.summary.total_eggs}`);
  lines.push(`summary,average_weight,${data.summary.average_weight ?? ""}`);
  lines.push(`summary,total_laying_chickens,${data.summary.total_laying_chickens}`);
  lines.push(`summary,active_laying_chickens,${data.summary.active_laying_chickens}`);

  // Production daily
  lines.push("");
  lines.push("section,date,count");
  for (const row of data.production_daily) {
    lines.push(`production_daily,${row.date},${row.count}`);
  }

  // Production weekly
  lines.push("");
  lines.push("section,date,count");
  for (const row of data.production_weekly) {
    lines.push(`production_weekly,${row.date},${row.count}`);
  }

  // Production monthly
  lines.push("");
  lines.push("section,date,count");
  for (const row of data.production_monthly) {
    lines.push(`production_monthly,${row.date},${row.count}`);
  }

  // Average weight per hen
  lines.push("");
  lines.push("section,chicken_id,chicken_name,avg_weight");
  for (const row of data.average_weight_per_hen) {
    lines.push(`avg_weight,${row.chicken_id},${row.chicken_name},${row.avg_weight ?? ""}`);
  }

  // Weight variance per hen
  lines.push("");
  lines.push("section,chicken_id,chicken_name,min_weight,max_weight,std_dev");
  for (const row of data.weight_variance_per_hen) {
    lines.push(`weight_variance,${row.chicken_id},${row.chicken_name},${row.min_weight ?? ""},${row.max_weight ?? ""},${row.std_dev ?? ""}`);
  }

  // Most productive
  lines.push("");
  lines.push("section,chicken_id,chicken_name,egg_count");
  for (const row of data.most_productive) {
    lines.push(`most_productive,${row.chicken_id},${row.chicken_name},${row.egg_count}`);
  }

  // Production consistency
  lines.push("");
  lines.push("section,chicken_id,chicken_name,egg_count,active_days,laying_rate");
  for (const row of data.production_consistency) {
    lines.push(`consistency,${row.chicken_id},${row.chicken_name},${row.egg_count},${row.active_days},${row.laying_rate}`);
  }

  // Dry periods
  lines.push("");
  lines.push("section,chicken_id,chicken_name,days_since_last_egg");
  for (const row of data.dry_periods_current) {
    lines.push(`dry_period_current,${row.chicken_id},${row.chicken_name},${row.days_since_last_egg ?? ""}`);
  }

  // Dry period alerts
  lines.push("");
  lines.push("section,chicken_id,chicken_name,days_since_last_egg");
  for (const row of data.dry_periods_alert) {
    lines.push(`dry_period_alert,${row.chicken_id},${row.chicken_name},${row.days_since_last_egg ?? ""}`);
  }

  // Seasonal trends
  lines.push("");
  lines.push("section,year,month,season,egg_count");
  for (const row of data.seasonal_trends) {
    lines.push(`seasonal,${row.year},${row.month},${row.season},${row.egg_count}`);
  }

  // Attrition
  lines.push("");
  lines.push("section,reason,count");
  for (const row of data.attrition_by_reason) {
    lines.push(`attrition,${row.reason},${row.count}`);
  }
  lines.push(`attrition_rate,,${data.attrition_rate ?? ""}`);

  return lines.join("\n") + "\n";
}
```

Then in the `GET` handler, add after line 19 (`const data = await getAnalytics(...)`) and before the `return NextResponse.json(data)`:

```typescript
const format = searchParams.get("format");
if (format === "csv") {
  const csv = analyticsToCsv(data);
  const filename = `chickentrack-analytics-${dateFrom || "default"}-${dateTo || "default"}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

Make sure the `format` variable doesn't conflict — add it after the existing `dryThresholdDays` assignment.

**Verify**: `npx tsc --noEmit` → exit 0, no errors.

### Step 2: Add Export CSV button to dashboard

In `src/app/dashboard/page.tsx`, find the date-range controls section (around lines 228-270). After the date inputs and before the refresh button, add an Export CSV button.

The date controls section currently looks like:
```tsx
<div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
  <label htmlFor="from">From</label>
  <input id="from" type="date" value={dateFrom} onChange={...} />
</div>
<div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
  <label htmlFor="to">To</label>
  <input id="to" type="date" value={dateTo} onChange={...} />
</div>
```

Add a button after the `To` input group and before the `/div` closing the controls container:

```tsx
<button
  onClick={() => {
    const url = `/api/analytics?from=${dateFrom}&to=${dateTo}&format=csv`;
    window.open(url, "_blank");
  }}
  style={{
    padding: "0.4rem 0.75rem",
    background: "#2e7d32",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.875rem",
    whiteSpace: "nowrap",
  }}
>
  Export CSV
</button>
```

Place it within the same `flex` container that wraps the date inputs (line 222's div with `display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap"`). The button goes just before the closing `</div>` of that container.

**Verify**: `npx tsc --noEmit` → exit 0, no errors.

### Step 3: Run full verification

**Verify**: `npm test` → all existing tests pass.
**Verify**: `npm run lint` → exit 0.

## Test plan

No new tests. The CSV serialization is a pure function that transforms the existing JSON response shape. The analytics integration tests (Plan 005) cover the data fetching; CSV formatting correctness can be verified manually by visiting `/api/analytics?from=2026-01-01&to=2026-12-31&format=csv` in a browser and confirming a `.csv` file downloads.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0
- [ ] `npm run lint` exits 0
- [ ] `GET /api/analytics?from=2026-01-01&to=2026-12-31&format=csv` returns `Content-Type: text/csv` with a downloadable CSV file
- [ ] `GET /api/analytics?from=2026-01-01&to=2026-12-31` (no format param) still returns JSON
- [ ] Dashboard page renders "Export CSV" button
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

- The code at the locations above doesn't match the excerpts (codebase has drifted).
- A step's verification fails twice after a reasonable fix attempt.
- The fix requires touching an out-of-scope file.

## Maintenance notes

- If new metric fields are added to `AnalyticsData` (in `src/lib/analytics.ts`), the `analyticsToCsv` function should be updated to include them. This is a manual step — there's no automatic mapping from the type to CSV columns.
- The `window.open` approach opens the CSV in a new tab which triggers a download. If the user has popups blocked, they'll need to allow them. An alternative is creating a hidden `<a>` element with `download` attribute — use that if `window.open` is problematic.
- CSV values are not escaped for commas or quotes. If chicken names or breeds could contain commas or double quotes (unlikely but possible), add proper CSV escaping: wrap values containing commas or quotes in double quotes, and double any internal quotes.
