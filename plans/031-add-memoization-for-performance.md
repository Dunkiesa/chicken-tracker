# Plan 031: Add React.memo and useMemo for list-rendering performance

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5920c0f..HEAD -- src/app/page.tsx src/app/roster/page.tsx src/app/log-egg/page.tsx src/app/chickens/\[id\]/page.tsx src/components/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `5920c0f`, 2026-07-04
- **Reconciled**: Line numbers updated for log-egg and roster pages (shifted by Plans 024, 027, 030). Plan 024 changed the departure form state shape — the ChickenTableRow extraction in Step 3 must match the new per-chicken state. `npm run test:all` added to verification commands.

## Why this matters

Every page component re-renders in its entirety on every state change. With the current flock size of ~5 birds this is imperceptible, but at the practical ceiling of ~100 birds (per `CONTEXT.md`), each keystroke in the Log page's weight input would re-render all 100 weight inputs, and clicking "Mark Departed" on the roster page would re-render the entire chicken table. Each page is 500-1100 lines, so React reconciliation on every state change is wasteful.

This plan extracts frequently-re-rendered list items into `React.memo()` components and wraps computed values in `useMemo` — targeted optimizations for the highest-churn render paths.

## Current state

**`src/app/log-egg/page.tsx:285-377`** — Hen rows array inlined inside `LogEggContent`, no memoization. Every state change (including typing a weight) re-renders all rows:

```tsx
{hens.map((hen) => {
  const existing = existingEggsMap.get(hen.id);
  // ... full row JSX inlined
})}
```

**`src/app/roster/page.tsx:443-702`** — Chicken table rows inlined inside `RosterPage`. Opening/closing the departure form re-renders all rows. Note: Plan 024 added per-chicken departure state tracking — the departure form now shows a confirm dialog before switching chickens.

```tsx
{chickens.map((chicken) => (
  <tr key={chicken.id} style={{...}}>
    {/* ... full row JSX inlined */}
  </tr>
))}
```

**`src/app/page.tsx:194-200`** — `productionData` is a computed value that could be memoized:

```tsx
const productionData =
  data &&
  (granularity === "daily"
    ? data.production_daily
    : granularity === "weekly"
    ? data.production_weekly
    : data.production_monthly);
```

**`src/app/chickens/[id]/page.tsx:998-1140`** — Notes list inlined with no memoization. Note: the notes change infrequently (on add/edit/delete), so the memoization gain here is modest. This is the lowest-priority extraction within this plan.

All components use inline styles throughout — extracted sub-components should continue this convention.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build     | `npm run build`          | exit 0              |
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| All tests | `npm run test:all`       | all pass            |

## Scope

**In scope**:
- `src/components/HenRow.tsx` (CREATE) — memoized hen row for log-egg page
- `src/components/ChickenTableRow.tsx` (CREATE) — memoized chicken table row for roster page
- `src/app/log-egg/page.tsx` — import `HenRow`, replace inline map
- `src/app/roster/page.tsx` — import `ChickenTableRow`, replace inline map
- `src/app/page.tsx` — add `useMemo` for `productionData` and summary cards
- `src/app/chickens/[id]/page.tsx` — add `React.memo` for note items (inline extraction only, no new file)

**Out of scope**:
- Extracting photo gallery items — photos are loaded from URLs and change infrequently; memoization gain is marginal
- Extracting analytics section cards — analytics data changes only on refresh, not on keystroke
- CSS modules or any styling changes
- Performance testing infrastructure

## Git workflow

- Branch: `improve/031-add-memoization-for-performance`
- Commits: one per extraction (HenRow, ChickenTableRow, useMemo) or one bulk commit
- Message: `perf: add React.memo/useMemo for list rendering performance`
- Do NOT push or open a PR

## Steps

### Step 1: Create `HenRow` component

Create `src/components/HenRow.tsx`:

```tsx
"use client";
import { memo } from "react";

type HenRowProps = {
  hen: { id: number; name: string; primary_photo_path: string | null };
  weight: string;
  existing: { id: number; weight: number } | undefined;
  warning: { type: string; message: string }[] | undefined;
  disabled: boolean;
  onWeightChange: (henId: number, value: string) => void;
};

function HenRowInner({ hen, weight, existing, warning, disabled, onWeightChange }: HenRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.6rem 0.75rem",
        borderBottom: "1px solid #f0f0f0",
        background: existing ? "#f5f5f5" : "transparent",
      }}
    >
      {hen.primary_photo_path ? (
        <img
          src={`/api/photos/${hen.primary_photo_path}`}
          alt=""
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            objectFit: "cover",
            background: "#f0f0f0",
            flexShrink: 0,
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: "#f0f0f0",
            flexShrink: 0,
          }}
        />
      )}
      <div style={{ flex: "1 1 100px", fontWeight: 500, fontSize: "0.95rem", minWidth: 0 }}>
        {hen.name}
      </div>
      {existing ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ fontSize: "0.85rem", color: "#666" }}>
            {existing.weight.toFixed(2)}g
          </span>
          <span style={{ color: "#2e7d32", fontSize: "1rem" }}>✓</span>
        </div>
      ) : (
        <input
          type="number"
          step="0.01"
          min="0"
          value={weight}
          onChange={(e) => onWeightChange(hen.id, e.target.value)}
          placeholder="Weight (g)"
          disabled={disabled}
          style={{
            width: "110px",
            padding: "0.4rem",
            border: "1px solid #ccc",
            borderRadius: "4px",
            fontSize: "0.9rem",
            textAlign: "right",
            flexShrink: 0,
          }}
        />
      )}
      {warning?.length > 0 && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "#f57f17",
            maxWidth: "160px",
            textAlign: "right",
            flexShrink: 0,
          }}
        >
          {warning.map((w, i) => (
            <div key={i}>{w.message}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export const HenRow = memo(HenRowInner);
```

**Verify**: `npm run build` exits 0.

### Step 2: Use `HenRow` in the log-egg page

In `src/app/log-egg/page.tsx`, add the import at the top:

```tsx
import { HenRow } from "../components/HenRow";
```

Replace the inline hen row JSX (lines 285-377) with:

```tsx
{hens.map((hen) => (
  <HenRow
    key={hen.id}
    hen={hen}
    weight={weights[hen.id] || ""}
    existing={existingEggsMap.get(hen.id)}
    warning={rowWarnings[hen.id]}
    disabled={saving}
    onWeightChange={(henId, value) =>
      setWeights((prev) => ({ ...prev, [henId]: value }))
    }
  />
))}
```

**Verify**: `npm run build` exits 0. `npm run test:all` exits 0. The log-egg page renders identically.

### Step 3: Create `ChickenTableRow` component

Create `src/components/ChickenTableRow.tsx` with the same memo pattern. Extract a single table row from the roster page's chicken list (the `<tr>` element at lines 444-701). This is a larger component — keep all the departure form, reinstate button, and action column logic inside it.

The props needed:
- `chicken` — the chicken data object
- `isAdmin` — boolean
- `departingChickenId` — number or null (for showing the departure form)
- `departureDate`, `departureReason`, `departureOtherReason` — form state
- `departingSave` — boolean
- `onMarkDeparted`, `onReinstate`, `onStartDepart` — event handlers

Note: Plan 024 added per-chicken departure tracking with a confirm-dialog before switching chickens. The `onStartDepart` callback needs to handle this logic — pass the full click handler from the parent:

```tsx
onStartDepart={() => {
  if (departingChickenId !== null && departingChickenId !== chicken.id) {
    if (!confirm("Discard unsaved departure details?")) return;
  }
  setDepartingChickenId(chicken.id);
  setDepartureDate(todayStr());
  setDepartureReason("died/illness");
  setDepartureOtherReason("");
  setEnrollError(null);
}}
```

Since the departure form state is tightly coupled, one approach is to pass individual props. A cleaner alternative (deferred): extract the departure form into its own sub-component. For this plan, pass all state and handlers as props.

**Verify**: `npm run build` exits 0. `npm run test:all` exits 0. The roster page renders identically.

### Step 4: Add `useMemo` to analytics dashboard

In `src/app/page.tsx`, wrap `productionData` at line 194-200 in `useMemo`:

```tsx
import { useMemo } from "react";
// (add useMemo to the import at line 3)

const productionData = useMemo(
  () =>
    data &&
    (granularity === "daily"
      ? data.production_daily
      : granularity === "weekly"
      ? data.production_weekly
      : data.production_monthly),
  [data, granularity]
);
```

Also wrap the summary cards array (lines 326-353) in `useMemo` to avoid re-creating the array on every render.

**Verify**: `npm run build` exits 0.

### Step 5: Add `React.memo` for note items in chicken profile

In `src/app/chickens/[id]/page.tsx`, extract the note rendering into a `React.memo` component defined in the same file (below the main component, before the closing). Since it's a single file, define:

```tsx
const NoteItem = memo(function NoteItem({
  note,
  isEditing,
  editContent,
  editDate,
  saving,
  canModify,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
  onEditContentChange,
  onEditDateChange,
}: { ... }) {
  // ... render the note card from lines 1001-1139
});
```

**Verify**: `npm run build` exits 0. `npm run test:all` exits 0. The chicken profile page renders identically.

## Test plan

Run `npm run test:all` — both the unit/integration tests and the Plan 025 component tests must pass. The memoization only affects re-render behavior, not visible output. Verify by interacting with each page and confirming no visual regressions:

1. Log page: type weights for multiple hens, verify input responsiveness and correct display
2. Roster page: open departure forms, verify chicken list still renders correctly
3. Dashboard: change date range and granularity, verify data updates correctly
4. Chicken profile: add/edit/delete notes, verify list updates correctly

## Done criteria

- [ ] `npm run build` exits 0
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run test:all` exits 0
- [ ] `HenRow` component extracted and used in log-egg page
- [ ] `ChickenTableRow` component extracted and used in roster page
- [ ] `productionData` and summary cards in dashboard wrapped in `useMemo`
- [ ] `NoteItem` memoized component extracted in chicken profile page
- [ ] All pages render identically to before the change

## STOP conditions

- If any extracted component requires prop drilling that significantly increases component complexity, report and scope can be reduced to only the simplest extractions (HenRow + useMemo).
- If the roster page's departure form has been refactored to per-chicken state (Plan 024), adjust `ChickenTableRow` props to match the new state shape.
- If TypeScript strict mode produces errors about prop types in memoized components, add explicit type annotations to the function arguments.

## Maintenance notes

- `React.memo` uses shallow comparison by default. If a prop is an object/array that is re-created on every render (even if the values haven't changed), memoization won't help. The `onWeightChange` callback in the log-egg page is a concern — it might be re-created on every render. If re-renders are still excessive, wrap the parent-level handler in `useCallback`.
- The `HenRow` and `ChickenTableRow` components are in `src/components/` for reuse. If a future page needs to display a similar list, these components can be reused.
- `NoteItem` is defined in the same file as `ChickenProfilePage` because it has tight coupling to the page's data shape. Extract to `src/components/` only if a second page needs it.
- This is the lowest-priority plan — the performance wins only matter at scale (>20 birds). Skip or defer if higher-priority work needs the time.
- **Verification commands**: After Plans 025a-025g and 4c80f40, use `npm run test:all` to run both unit and component tests. `npm test` only runs unit tests (excludes component tests).
