# Plan 014: Add duplicate-date override UI to Bulk Log page

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 3ccb427..HEAD -- src/app/log-egg/page.tsx src/app/api/eggs/route.ts`
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

The old single-egg log page had a two-step duplicate detection flow: if an egg already existed for a chicken on the same date, it showed a 409 error with the message "Save again to add another anyway." The user could then re-submit with `override_duplicate: true` to log a second egg.

The new Bulk Log page silently allows duplicates — the `createEggs` function warns but still inserts. However, the UI shows no explicit confirmation prompt, and the batch submit doesn't use the `?override_duplicate=true` query param that the API supports. Users who accidentally log a duplicate won't be warned, and users who intentionally want a second egg won't have the satisfaction of an explicit override.

## Current state

`src/app/log-egg/page.tsx:100-156` — `handleBulkSubmit` sends entries directly without checking for duplicates:
```tsx
const res = await fetch("/api/eggs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(entries),
});
```

The API at `src/app/api/eggs/route.ts:53` supports `?override_duplicate=true`:
```tsx
const overrideDuplicate = request.nextUrl.searchParams.get("override_duplicate") === "true";
const result = await createEggs(inputs, overrideDuplicate);
```

But nothing in the UI sets this param.

The `existingEggsMap` state (lines 56, 90-93) already tracks which hens have eggs for the selected batch date. Hens with existing eggs show a checkmark and their weight (read-only) in the grid. The bulk submit already filters these out:
```tsx
const entries = hens
  .filter((h) => !existingEggsMap.has(h.id) && weights[h.id] && parseFloat(weights[h.id]) > 0)
```

So duplicates CAN'T happen through the normal flow — only hens without existing eggs get submitted. However, if a user changes the date after filling in weights, or if there's a race condition, duplicates could theoretically occur.

## Approach

Since the grid already excludes hens with existing eggs (they show a checkmark and are read-only), the primary remaining risk is the boundary case where a hen already has an egg for the date but it's not yet in `existingEggsMap` (stale data). The simplest improvement is to show a warning banner when the API returns duplicate-date warnings in the response, and offer a "Override and save anyway" button.

Actually, the simpler approach: since `existingEggsMap` already prevents double-submission in the normal flow, and the API's batch `createEggs` already warns (not blocks) on duplicates, the most useful improvement is:

After batch submit, if any row-warnings contain `"duplicate_date"`, show a prominent warning below the success message telling the user which hen(s) had duplicates and that a second egg was logged anyway.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build     | `npm run build`          | exit 0, compiled successfully |
| Lint      | `npm run lint`           | exit 0              |

## Scope

**In scope**:
- `src/app/log-egg/page.tsx` — add duplicate warning display after batch submit

**Out of scope**:
- Changing the API route
- Changing the `createEggs` library function
- Other files

## Git workflow

- Branch: from `HEAD` (current `bulkadd`), create `improve/014-duplicate-override-ui`
- Commit message style: `feat: show duplicate-date warnings after batch submit`
- Do NOT push or open a PR.

## Steps

### Step 1: Add duplicate warnings section

After the batch submit, the `rowWarnings` state already contains per-row warnings (set at lines 132-139). The warning rendering already exists at lines 329-343, shown inline per hen row.

To make duplicates more visible, add a separate summary warning below the success/error messages (after line 380) that checks if any rowWarnings contain `"duplicate_date"` warnings:

```tsx
{Object.entries(rowWarnings).length > 0 && (
  <div style={{
    padding: "0.5rem 0.75rem",
    background: "#fff8e1",
    border: "1px solid #ffd54f",
    borderRadius: "4px",
    fontSize: "0.85rem",
    color: "#f57f17",
    marginBottom: "0.75rem",
  }}>
    {Object.entries(rowWarnings).map(([chickenId, warns]) => (
      warns.filter(w => w.type === "duplicate_date").map((w, i) => (
        <div key={`${chickenId}-${i}`}>{w.message}</div>
      ))
    ))}
  </div>
)}
```

This renders a yellow warning box if any duplicate warnings were returned by the API.

**Verify**: `npm run build` → compiled successfully.

## Test plan

Manual verification:
- Create an egg for a hen on today's date (via direct API call or by setting up the DB)
- Navigate to /log-egg, select the same date
- Note the hen already has a checkmark and is read-only (no duplicate can be submitted via normal flow)
- To test the duplicate warning path, temporarily modify the code to bypass the `existingEggsMap` filter in `handleBulkSubmit`, submit, and verify the yellow warning box appears with the duplicate message

## Done criteria

- [ ] `npm run build` exits 0
- [ ] `npm run lint` exits 0
- [ ] Duplicate-date warnings returned by the API are displayed in a yellow warning box below the form
- [ ] No files outside `src/app/log-egg/page.tsx` are modified

## STOP conditions

Stop and report back if:

- The code excerpts don't match the live code.
- `npm run build` fails with an error not clearly related to the changes.
- The `createEggs` function no longer returns per-entry warnings as described.

## Maintenance notes

- This is a relatively minor UI improvement since the existing flow already prevents duplicate submission in the common case (hens with eggs are shown as logged and are excluded from submit). The plan is mainly about catching edge cases (stale data, race conditions).
