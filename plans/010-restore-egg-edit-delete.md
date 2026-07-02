# Plan 010: Restore egg edit/delete on Bulk Log page

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

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `3ccb427`, 2026-07-02

## Why this matters

The Bulk Log rewrite removed the Edit and Delete buttons from the egg history table at the bottom of the page. The API endpoints (PUT/DELETE `/api/eggs/[id]`) still exist and work, but there is no UI to call them. Users cannot correct a mistyped weight, wrong date, or delete a mistakenly logged egg. This is a full regression of an existing feature.

## Current state

The egg history table at the bottom of `src/app/log-egg/page.tsx` (lines 416–440) has three columns: Date, Chicken, Weight. No Actions column. The table is read-only.

```tsx
// src/app/log-egg/page.tsx:417-440
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
  <thead>
    <tr style={{ borderBottom: "2px solid #eee" }}>
      <th style={{ textAlign: "left", padding: "0.4rem 0.4rem 0.4rem 0", fontWeight: 600 }}>Date</th>
      <th style={{ textAlign: "left", padding: "0.4rem", fontWeight: 600 }}>Chicken</th>
      <th style={{ textAlign: "right", padding: "0.4rem", fontWeight: 600 }}>Weight</th>
    </tr>
  </thead>
  <tbody>
    {eggs.map((egg) => (
      <tr key={egg.id} style={{ borderBottom: "1px solid #eee" }}>
        <td style={{ padding: "0.4rem 0.4rem 0.4rem 0", color: "#555" }}>{egg.date}</td>
        <td style={{ padding: "0.4rem", fontWeight: 500 }}>{egg.chicken_name}</td>
        <td style={{ padding: "0.4rem", textAlign: "right" }}>{egg.weight.toFixed(2)}g</td>
      </tr>
    ))}
  </tbody>
</table>
```

The session user's role is available via `session?.user?.role`. Viewers may only edit/delete their own eggs (matched by `recorded_by`); Admins may edit/delete any egg. The API enforces this server-side.

The API endpoints (not changed, still working):
- `PUT /api/eggs/[id]` — updates weight, date, chicken_id
- `DELETE /api/eggs/[id]` — deletes an egg

Egg type:
```tsx
type Egg = {
  id: number;
  chicken_id: number;
  chicken_name: string;
  weight: number;
  date: string;
  recorded_by: string;
};
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build     | `npm run build`          | exit 0, compiled successfully |
| Lint      | `npm run lint`           | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `src/app/log-egg/page.tsx` — restore Edit/Delete in egg history table

**Out of scope** (do NOT touch):
- Any other page file (main page, chicken profile, dashboard)
- API route files
- Library files
- Test files

## Git workflow

- Branch: from `HEAD` (current `bulkadd`), create `improve/010-restore-egg-edit-delete`
- Commit message style: `fix: restore egg edit/delete actions on bulk log page`
- Do NOT push or open a PR.

## Steps

### Step 1: Add state variables for inline editing

Add these state variables after the existing state declarations (around line 58):

- `editingEggId: number | null` (initial `null`) — which egg is being edited
- `editWeight: string` (initial `""`) — weight input during edit
- `editDate: string` (initial `""`) — date input during edit

### Step 2: Add handleEdit and handleDelete functions

Add these before `handleBulkSubmit` (before line 100):

**handleEdit(egg: Egg)**: sets `editingEggId` to `egg.id`, `editWeight` to `egg.weight.toString()`, `editDate` to `egg.date`, clears `error` and `successMsg`.

**handleDelete(egg: Egg)**: calls `confirm()` with a message like `"Delete egg for ${egg.chicken_name} on ${egg.date}?"`. If confirmed, sends `DELETE /api/eggs/${egg.id}`. On success, re-fetches eggs with `fetch("/api/eggs")` and sets `eggs` state. On failure, displays the error message.

### Step 3: Add Actions column to egg history table

Modify the table:

- Add a fourth `<th>` to the header row: `Actions` with `textAlign: "center"`.
- Add a fourth `<td>` in each row, conditionally rendering:
  - If `editingEggId === egg.id`: show an inline edit form with weight input, date input, Save button and Cancel button.
  - Otherwise: show Edit and Delete buttons (only if the user is authorized: `isAdmin || egg.recorded_by === session?.user?.email`).

Use the same inline editing pattern as the departed form on the main page (see `src/app/page.tsx:775-811` for the button style pattern) — small buttons, flex layout, consistent border/radius/padding.

**Save button**: sends `PUT /api/eggs/${editingEggId}` with `{ weight: parseFloat(editWeight), date: editDate }`. On success, clears `editingEggId` and re-fetches eggs. On 409 (duplicate), shows the error with instruction to save again (re-use the same approach: store an override flag and re-send with `override_duplicate: true` in the body).

**Cancel button**: sets `editingEggId` to `null`.

**Verify**: `npm run build` → compiled successfully, no errors.

### Step 4: Determine authorization per egg

At the top of the component (around line 46), add `const isAdmin = session?.user?.role === "Admin";`.

In the Actions cell for each egg, only show Edit/Delete when `isAdmin || egg.recorded_by === session?.user?.email`.

**Verify**: `npm run build` → compiled successfully.

## Test plan

This is a UI-only change. The existing API tests (`tests/eggs.integration.test.ts`) already cover the edit/delete endpoints. No new tests for this plan — the UI is covered by manual inspection:
- Navigate to /log-egg, verify Actions column appears
- Verify Edit populates the inline form
- Verify Save updates the egg and re-renders
- Verify Delete removes the egg
- Verify Viewer users only see Edit/Delete on their own eggs

## Done criteria

- [ ] `npm run build` exits 0
- [ ] `npm run lint` exits 0
- [ ] The egg history table on the Bulk Log page has a visible Actions column
- [ ] Clicking Edit shows an inline edit form with weight, date, Save, Cancel
- [ ] Clicking Save calls PUT and refreshes the egg list
- [ ] Clicking Delete calls DELETE and refreshes the egg list
- [ ] Viewer users only see Edit/Delete for their own eggs
- [ ] No files outside `src/app/log-egg/page.tsx` are modified

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations above doesn't match the excerpts (the codebase has drifted).
- `npm run build` fails with an error that isn't clearly related to the changes.
- The API endpoints (`PUT/DELETE /api/eggs/[id]`) don't exist or have a different contract than described.

## Maintenance notes

- If the egg history table's columns change in the future, the Actions column should move with it.
- The `canDelete` check uses the session user's email — this must stay in sync with the server-side authorization in `src/app/api/eggs/[id]/route.ts`.
