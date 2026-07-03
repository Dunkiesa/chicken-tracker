# Plan 028: Fix save button text showing wrong state variable in chicken edit form

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9f05e7b..HEAD -- src/app/chickens/\[id\]/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `9f05e7b`, 2026-07-03

## Why this matters

The chicken edit form's Save button uses the wrong state variable for its loading text. The button reads `saving` (which tracks note-saving) instead of `savingChicken` (which tracks chicken-saving). While the button IS correctly disabled via `savingChicken`, the displayed text always says "Save" even during chicken save operations — the user never sees "Saving..." during saves, providing no visual feedback.

## Current state

`src/app/chickens/[id]/page.tsx:65-75` — Two separate loading states exist:

```tsx
const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
const [editContent, setEditContent] = useState("");
const [editDate, setEditDate] = useState("");
const [saving, setSaving] = useState(false);           // line 68 — tracks NOTE saving

const [editing, setEditing] = useState(false);
const [savingChicken, setSavingChicken] = useState(false); // line 75 — tracks CHICKEN saving
```

`src/app/chickens/[id]/page.tsx:690-693` — The Save button uses `saving` (wrong):

```tsx
<button
  type="submit"
  disabled={savingChicken || !editName.trim()}
  ...
>
  {saving ? "Saving..." : "Save"}     {/* line 692: uses 'saving', should use 'savingChicken' */}
</button>
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build     | `npm run build`          | exit 0              |
| Typecheck | `npx tsc --noEmit`       | exit 0              |

## Scope

**In scope**:
- `src/app/chickens/[id]/page.tsx` — one character change on line 692

**Out of scope**:
- Any other file
- Any other part of the chicken profile page

## Git workflow

- Branch: `improve/028-fix-save-button-state`
- Commit: `fix: use correct state variable for chicken save button text`
- Do NOT push or open a PR

## Steps

### Step 1: Fix the state variable reference

In `src/app/chickens/[id]/page.tsx`, line 692, change:

```tsx
{saving ? "Saving..." : "Save"}
```

to:

```tsx
{savingChicken ? "Saving..." : "Save"}
```

**Verify**: `npm run build` exits 0.

## Test plan

Navigate to a chicken profile, click "Edit", modify a field, click "Save". The button should briefly show "Saving..." while the save request is in flight, then return to "Save" after completion.

## Done criteria

- [ ] `npm run build` exits 0
- [ ] `npx tsc --noEmit` exits 0
- [ ] `grep "{saving ?" src/app/chickens/\[id\]/page.tsx` returns no matches
- [ ] `grep "savingChicken ? " src/app/chickens/\[id\]/page.tsx` returns at least one match

## STOP conditions

- If the chicken edit form save button has been rewritten or moved, stop and report.
- If `savingChicken` variable has been renamed, update the plan reference accordingly before making the change.

## Maintenance notes

- This is a pre-existing bug not introduced by this branch. If Plan 026 or any other plan modifies this file, coordinate to avoid merge conflicts on line 692.
- The sibling state variables `saving` (note edit) and `savingChicken` (chicken edit) are correctly distinguished everywhere else — only this button text was wrong.
