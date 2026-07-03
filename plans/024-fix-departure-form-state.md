# Plan 024: Fix departure form state — per-chicken tracking and stale reason cleanup

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9f05e7b..HEAD -- src/app/roster/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `9f05e7b`, 2026-07-03

## Why this matters

Two bugs in the roster page's departure form:

1. **Shared state overwrites unsaved input**: Single `departingChickenId` state variable controls which chicken's inline departure form is shown. If a user opens the departure form for chicken A, starts typing, then clicks "Mark Departed" on chicken B (or accidentally lands on it), chicken A's input is lost with no warning.

2. **Stale custom reason lingers**: When the departure reason dropdown is set to "Other", the user types a custom reason into `departureOtherReason`. If they then switch the dropdown to a non-"Other" option (e.g., "sold"), the typed text stays in state and reappears if they switch back to "Other".

Both are low-risk individually but together create a confusing UX for admins managing departures — a primary workflow.

## Current state

`src/app/roster/page.tsx:50-54` — Single departure form state:

```tsx
const [departingChickenId, setDepartingChickenId] = useState<number | null>(null);
const [departureDate, setDepartureDate] = useState(todayStr());
const [departureReason, setDepartureReason] = useState("died/illness");
const [departureOtherReason, setDepartureOtherReason] = useState("");
```

`src/app/roster/page.tsx:668-690` — The "Mark Departed" button onClick sets `departingChickenId`:

```tsx
<button
  onClick={() => {
    setDepartingChickenId(chicken.id);
    setDepartureDate(todayStr());
    setDepartureReason("died/illness");
    setDepartureOtherReason("");
    setEnrollError(null);
  }}
  ...
>
```

`src/app/roster/page.tsx:583-598` — The departure reason dropdown does NOT clear `departureOtherReason` when changed away from "Other":

```tsx
<select
  value={departureReason}
  onChange={(e) => setDepartureReason(e.target.value)}
  ...
>
  {DEPARTURE_REASONS.map((r) => (
    <option key={r} value={r}>{r}</option>
  ))}
</select>
```

The repo uses inline styles throughout — match this convention.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build     | `npm run build`          | exit 0              |
| Typecheck | `npx tsc --noEmit`       | exit 0              |

## Scope

**In scope**:
- `src/app/roster/page.tsx` — fix both bugs

**Out of scope**:
- Any other page or component
- Adding tests (handled in Plan 025)
- Refactoring the departure form into a separate component (deferred)

## Git workflow

- Branch: `improve/024-fix-departure-form-state`
- Commit: `fix: per-chicken departure form state and stale custom reason`
- Do NOT push or open a PR

## Steps

### Step 1: Clear `departureOtherReason` when reason changes from "Other"

In `src/app/roster/page.tsx`, replace the dropdown's `onChange` handler at line 586:

Current:
```tsx
onChange={(e) => setDepartureReason(e.target.value)}
```

Replace with:
```tsx
onChange={(e) => {
  setDepartureReason(e.target.value);
  if (e.target.value !== "Other") {
    setDepartureOtherReason("");
  }
}}
```

**Verify**: `npm run build` exits 0. The dropdown clears the custom reason field when switching to a non-"Other" reason.

### Step 2: Warn before discarding unsaved departure input

Add a confirmation when opening a new departure form while another is open. In `src/app/roster/page.tsx`, wrap the `onClick` handler at line 670:

Current:
```tsx
onClick={() => {
  setDepartingChickenId(chicken.id);
  setDepartureDate(todayStr());
  setDepartureReason("died/illness");
  setDepartureOtherReason("");
  setEnrollError(null);
}}
```

Replace with:
```tsx
onClick={() => {
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

**Verify**: `npm run build` exits 0. When a departure form is open for one chicken and another "Mark Departed" button is clicked, a confirmation dialog appears.

## Test plan

Manual verification steps:
1. Navigate to `/roster`
2. Click "Mark Departed" on chicken A — form opens
3. Set a non-default departure date and reason
4. Click "Mark Departed" on chicken B — confirmation dialog appears: "Discard unsaved departure details?"
5. Dismiss the dialog — chicken A's form stays open
6. Select "Other" from reason dropdown, type custom text, then switch to "died/illness" — custom text disappears
7. Click "Cancel" on chicken A's form — form closes cleanly

## Done criteria

- [ ] `npm run build` exits 0
- [ ] `npx tsc --noEmit` exits 0
- [ ] Switching reason dropdown from "Other" to a preset clears the custom reason
- [ ] Opening a second departure form while one is open shows a confirmation
- [ ] No files outside `src/app/roster/page.tsx` are modified

## STOP conditions

- If the roster page has been substantially rewritten (different state management approach), stop and report.
- If `confirm()` is not the project's preferred approach for confirmation dialogs (check if other dialogs exist in the codebase — the notes delete uses `confirm` at `src/app/chickens/[id]/page.tsx:199`), adjust accordingly.

## Maintenance notes

- If the departure form is extracted into its own component in the future, move the state to `Record<number, DepartureFormState>` instead of the current single-state approach.
- The `confirm()` dialog is aligned with the existing pattern used for note deletion (`src/app/chickens/[id]/page.tsx:199`).
