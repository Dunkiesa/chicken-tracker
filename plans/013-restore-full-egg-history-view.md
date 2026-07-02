# Plan 013: Restore full egg history view on Bulk Log page

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

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `3ccb427`, 2026-07-02

## Why this matters

The Bulk Log rewrite scoped the egg history table to only show eggs for the selected batch date (`/api/eggs?date=${batchDate}`). The old page showed all eggs in reverse chronological order. Users can no longer browse the full egg history from the log-egg page — they must navigate to another view or change dates repeatedly to see previous records.

## Current state

`src/app/log-egg/page.tsx:60-74` — the eggs are fetched without a date filter:
```tsx
useEffect(() => {
  if (status === "unauthenticated") {
    router.push("/");
    return;
  }
  if (status !== "authenticated") return;
  (async () => {
    try {
      const res = await fetch("/api/eggs");
      if (res.ok) setEggs(await res.json());
    } catch {
      // ignore
    }
  })();
}, [status, router]);
```

This `useEffect` runs once on mount and sets `eggs` — which is used in the egg history table at lines 413-442. The `eggs` state is set from an unfiltered API call, so the full history IS fetched on mount. However, it's never refreshed after a batch submit (the bulk submit handler re-fetches date-scoped eggs into `existingEggsMap` but does not update `eggs`).

So the current state is: full egg history on initial load, but stale after a batch submit (the "Recent Eggs" section doesn't update to include newly logged eggs).

**This is actually two related issues:**
1. The "Recent Eggs" section heading says "Recent Eggs" but shows all eggs (not limited to recent)
2. The egg list is not refreshed after a batch submit

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build     | `npm run build`          | exit 0, compiled successfully |
| Lint      | `npm run lint`           | exit 0              |

## Scope

**In scope**:
- `src/app/log-egg/page.tsx` — refresh egg history after batch submit

**Out of scope**:
- Any other file
- Adding date filtering to the history table (out of scope for this plan — the full history should remain visible)
- Changing "Recent Eggs" heading wording

## Git workflow

- Branch: from `HEAD` (current `bulkadd`), create `improve/013-restore-egg-history-refresh`
- Commit message style: `fix: refresh egg history after batch submit`
- Do NOT push or open a PR.

## Steps

### Step 1: Add an `eggsRefresh` dependency or refresh inline

The simplest fix: after the batch submit successfully completes (inside `handleBulkSubmit`, after the `setExistingEggsMap` block at lines 144-150), add a re-fetch of `eggs`:

```tsx
const eggsRes2 = await fetch("/api/eggs");
if (eggsRes2.ok) {
  setEggs(await eggsRes2.json());
}
```

Place this right after the `if (eggsRes.ok) { ... }` block that updates `existingEggsMap` (after line 150).

Alternatively, extract a `refreshEggs` function and call it both on mount and after submit. If you choose this approach:
```tsx
async function refreshEggs() {
  try {
    const res = await fetch("/api/eggs");
    if (res.ok) setEggs(await res.json());
  } catch { /* ignore */ }
}
```

Then:
- Call `refreshEggs()` in the mount `useEffect` (line 68) instead of the inline fetch
- Call `refreshEggs()` at the end of `handleBulkSubmit` (after the `existingEggsMap` refresh, around line 150)

Either approach is fine — choose the cleaner one.

**Verify**: `npm run build` → compiled successfully.

## Test plan

Manual verification only:
- Navigate to /log-egg, verify the "Recent Eggs" table shows all eggs
- Submit a bulk batch, verify the table updates to include the new eggs
- Change the date and submit another batch, verify both days appear

## Done criteria

- [ ] `npm run build` exits 0
- [ ] `npm run lint` exits 0
- [ ] The egg history table shows all eggs (not date-scoped)
- [ ] After submitting a bulk batch, the egg history table refreshes to include the new entries
- [ ] No files outside `src/app/log-egg/page.tsx` are modified

## STOP conditions

Stop and report back if:

- The code excerpts don't match the live code.
- `npm run build` fails with an error not clearly related to the changes.
- The `/api/eggs` endpoint has changed and no longer returns all eggs.

## Maintenance notes

- If pagination is added to `/api/eggs`, this refresh approach will need updating.
- If the `handleBulkSubmit` function changes significantly (e.g. the success path), ensure the eggs refresh is preserved.
