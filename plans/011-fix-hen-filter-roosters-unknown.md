# Plan 011: Fix hen filter to include Unknown-sex and add "Show all" toggle

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 3ccb427..HEAD -- src/app/log-egg/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `3ccb427`, 2026-07-02

## Why this matters

The Bulk Log page filters chickens to only `sex === "Hen"`, excluding:
1. Chickens with `sex === "Unknown"` — documented as laying-eligible in CONTEXT.md ("Laying-eligible birds are Hens and Unknowns")
2. Roosters — CONTEXT.md says they should be "hidden from the egg picker by default (with a 'show all' escape hatch)" but the escape hatch was removed

Without this fix, Unknown-sex chickens cannot have eggs logged via the bulk log page, and there's no way to log eggs for roosters when needed.

## Current state

`src/app/log-egg/page.tsx:80` — the hen filter:
```tsx
.then((data) => setHens((data as Chicken[]).filter((c) => c.sex === "Hen" && !c.departed)))
```

This is the only place chickens are filtered for the egg picker grid. There is no state toggle for "show all" or "show roosters."

The filter is applied in a `useEffect` that runs on mount (when `status` becomes `"authenticated"`).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build     | `npm run build`          | exit 0, compiled successfully |
| Lint      | `npm run lint`           | exit 0              |

## Scope

**In scope**:
- `src/app/log-egg/page.tsx`

**Out of scope**:
- Any other file

## Git workflow

- Branch: from `HEAD` (current `bulkadd`), create `improve/011-fix-hen-filter`
- Commit message style: `fix: restore show-all toggle and Unknown-sex inclusion in egg picker`
- Do NOT push or open a PR.

## Steps

### Step 1: Add `showAll` state

Add after the existing state declarations (around line 58):
```tsx
const [showAll, setShowAll] = useState(false);
```

### Step 2: Update the filter

Change line 80 from:
```tsx
.then((data) => setHens((data as Chicken[]).filter((c) => c.sex === "Hen" && !c.departed)))
```
to:
```tsx
.then((data) => {
  const all = data as Chicken[];
  setHens(all.filter((c) => !c.departed && (showAll || c.sex !== "Rooster")));
})
```

Note: `showAll` will be `false` on first render (the effect runs once), so the initial filter excludes Roosters but includes Hens and Unknowns.

But wait — the `useEffect` that fetches chickens only runs on mount (`[status]` dependency). Adding `showAll` to the dependency array would make it re-fetch. Actually, since `hens` is local state derived from the fetch, we can re-filter without re-fetching.

Better approach — keep the raw chicken data in a separate state or re-filter when `showAll` changes. The simplest: add `showAll` to the effect's dependencies and re-run the fetch + filter when it changes. Since the fetch is cheap (small flock), this is fine.

Change the `useEffect` at lines 76-82 to depend on `[status, showAll]` instead of `[status]`:

```tsx
useEffect(() => {
  if (status !== "authenticated") return;
  fetch("/api/chickens")
    .then((res) => res.ok ? res.json() : [])
    .then((data) => setHens((data as Chicken[]).filter((c) => !c.departed && (showAll || c.sex !== "Rooster"))))
    .catch(() => {});
}, [status, showAll]);
```

**Verify**: `npm run build` → compiled successfully.

### Step 3: Add "Show all" toggle to the UI

Add a checkbox/label before the hen grid (around line 209, after the date picker `</div>` and before `{hens.length === 0 ?`):

```tsx
<div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "0.875rem" }}>
  <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer" }}>
    <input
      type="checkbox"
      checked={showAll}
      onChange={(e) => setShowAll(e.target.checked)}
    />
    Show all chickens (including roosters)
  </label>
  <span style={{ color: "#999" }}>{hens.length} available</span>
</div>
```

**Verify**: `npm run build` → compiled successfully.

## Test plan

No automated tests for this UI. Manual verification:
- Navigate to /log-egg while logged in
- Verify both Hens and Unknown-sex chickens appear in the grid
- Verify Roosters are hidden by default
- Toggle "Show all" — verify Roosters appear
- Verify the count text updates correctly

## Done criteria

- [ ] `npm run build` exits 0
- [ ] `npm run lint` exits 0
- [ ] Unknown-sex chickens appear in the egg picker grid
- [ ] Roosters are hidden by default
- [ ] "Show all" toggle checkbox is visible and functional
- [ ] Toggling the checkbox shows/hides roosters without a page reload
- [ ] No files outside `src/app/log-egg/page.tsx` are modified

## STOP conditions

Stop and report back if:

- The code excerpts don't match the live code.
- `npm run build` fails with an error not clearly related to the changes.

## Maintenance notes

- If the API's chicken endpoint changes its response shape, the filter in Step 2 will need updating.
- The "Show all" text mentions roosters specifically; if the app adds more sexes, update the label.
