# Plan 030: Remove redundant duplicate fetch after bulk egg submit

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9f05e7b..HEAD -- src/app/log-egg/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `9f05e7b`, 2026-07-03

## Why this matters

After a batch egg submit, the code fetches eggs by date AND then calls a general `refreshEggs()` which fetches ALL eggs. These are two separate network round trips when one suffices. The date-filtered fetch updates the `existingEggsMap` for the current batch date's checkboxes, while `refreshEggs()` updates the "Recent Eggs" table. Both can be satisfied by a single fetch with the relevant data transformation.

## Current state

`src/app/log-egg/page.tsx:180-188` — After batch submit, two consecutive fetches:

```tsx
// First: fetch eggs for the batch date to update existingEggsMap
const eggsRes = await fetch(`/api/eggs?date=${batchDate}`);
if (eggsRes.ok) {
  const eggsData: Egg[] = await eggsRes.json();
  const map = new Map<number, Egg>();
  eggsData.forEach((egg) => map.set(egg.chicken_id, egg));
  setExistingEggsMap(map);
}

// Second: fetch ALL eggs for the "Recent Eggs" table
await refreshEggs();
```

`refreshEggs()` at lines 65-72 fetches all eggs with no date filter:

```tsx
async function refreshEggs() {
  try {
    const res = await fetch("/api/eggs");
    if (res.ok) setEggs(await res.json());
  } catch {
    // ignore
  }
}
```

The `existingEggsMap` state is used only in the batch entry grid (check if a hen already has an egg today), while `eggs` state is used only in the "Recent Eggs" table.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope**:
- `src/app/log-egg/page.tsx` — inline fetch block to remove

**Out of scope**:
- Any other file
- The API route
- The `refreshEggs` function signature

## Git workflow

- Branch: `improve/030-remove-redundant-egg-fetch`
- Commit: `perf: remove duplicate egg fetch after batch submit by combining with refreshEggs`
- Do NOT push or open a PR

## Steps

### Step 1: Make `refreshEggs` accept an optional date filter

Modify `refreshEggs` at `src/app/log-egg/page.tsx:65-72` to accept an optional date parameter:

```tsx
async function refreshEggs(date?: string) {
  try {
    const url = date ? `/api/eggs?date=${date}` : "/api/eggs";
    const res = await fetch(url);
    if (res.ok) {
      const data: Egg[] = await res.json();
      setEggs(data);
      if (date) {
        const map = new Map<number, Egg>();
        data.forEach((egg) => map.set(egg.chicken_id, egg));
        setExistingEggsMap(map);
      }
    }
  } catch {
    // ignore
  }
}
```

**Verify**: `npm run build` exits 0. The `refreshEggs` function now accepts an optional `date` parameter.

### Step 2: Simplify the post-submit handler

In `src/app/log-egg/page.tsx`, replace lines 180-188 (the inline fetch + `refreshEggs()` call) with a single call:

Replace:
```tsx
const eggsRes = await fetch(`/api/eggs?date=${batchDate}`);
if (eggsRes.ok) {
  const eggsData: Egg[] = await eggsRes.json();
  const map = new Map<number, Egg>();
  eggsData.forEach((egg) => map.set(egg.chicken_id, egg));
  setExistingEggsMap(map);
}
await refreshEggs();
```

With:
```tsx
await refreshEggs(batchDate);
```

**Verify**: `npm run build` exits 0. The post-submit handler does a single fetch that populates both the existing eggs map and the recent eggs table.

## Test plan

Fill in egg weights for a few hens, submit the batch, verify:
1. The checkmark icons appear for the submitted hens (proof that `existingEggsMap` updated)
2. The "Recent Eggs" table shows the new entries (proof that `eggs` state updated)
3. Only one network request to `/api/eggs` is made (check browser dev tools Network tab)

## Done criteria

- [ ] `npm run build` exits 0
- [ ] `refreshEggs` accepts an optional `date` parameter
- [ ] The inline fetch block (lines 181-187) is removed from `handleBulkSubmit`
- [ ] After batch submit, only one `/api/eggs` request is made
- [ ] Both the checkmark icons and recent eggs table update correctly

## STOP conditions

- If the `handleBulkSubmit` function has been significantly rewritten, stop and report.
- If `refreshEggs` is called from multiple places with different expectations about its return value (currently it returns `void`), verify that changing its signature doesn't break other callers.

## Maintenance notes

- This is a minor perf improvement (saves one small network request per batch submit). The real value is in code clarity — the logic for refreshing egg state after submit is now in one function.
- If the API route's response shape for `/api/eggs` with and without `date` parameter diverges in the future, this combined approach could break. The date filter just adds a WHERE clause to the same query — response shape is identical.
