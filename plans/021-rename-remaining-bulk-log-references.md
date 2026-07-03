# Plan 021: Rename remaining "Bulk Log" references to "Log"

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 77b1e0d..HEAD -- src/app/log-egg/page.tsx CONTEXT.md`
> If either file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plan 019 (already DONE — renamed NavMenu "Bulk Log" → "Log")
- **Category**: direction
- **Planned at**: commit `77b1e0d`, 2026-07-03
- **Issue**: (omit unless published via `--issues`)

## Why this matters

Plan 019 renamed the NavMenu "Bulk Log" link to "Log" but left two other references: the page heading on the log-egg page still says "Bulk Log", and the domain glossary in `CONTEXT.md` still defines the feature by its old name. This plan completes the rename so "Bulk Log" is gone from all source and docs.

## Current state

**1. Page heading** — `src/app/log-egg/page.tsx:216`:
```tsx
      <h1 style={{ fontSize: "1.5rem" }}>Bulk Log</h1>
```

**2. Domain glossary** — `CONTEXT.md:20`:
```markdown
- **Bulk Log** — the mobile fast-path for egg entry: a single date applies to all entries, all hens are shown in a grid with per-row weight inputs, and eggs are submitted in a single batch. Replaces the old Quick Log.
```

### Repo conventions to follow

- All styling is done via inline `style` props — no CSS modules, no Tailwind.
- The page heading `<h1>` at line 216 uses `fontSize: "1.5rem"` with no other styling.
- `CONTEXT.md` uses markdown glossary format: `- **Term** — definition.`.
- Commit messages follow conventional commits, matching repo style (e.g. `refactor: rename Bulk Log to Log in page heading`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm install` | exit 0 |
| Lint | `npm run lint` | exit 0, no errors |
| Build | `npm run build` | exit 0, no errors |

## Scope

**In scope** (the only files you should modify):
- `src/app/log-egg/page.tsx` — the page heading
- `CONTEXT.md` — the glossary definition

**Out of scope** (do NOT touch, even though they look related):
- `plans/*.md` — historical plan files; they are immutable records of past work and should NOT be modified
- `src/components/NavMenu.tsx` — already renamed by plan 019
- Any other files — only the two listed above need changes

## Git workflow

- Branch: `advisor/021-rename-remaining-bulk-log-references`
- Commit per step (2 commits); message style: conventional commits
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Rename page heading in `src/app/log-egg/page.tsx`

Change line 216 from:
```tsx
      <h1 style={{ fontSize: "1.5rem" }}>Bulk Log</h1>
```
to:
```tsx
      <h1 style={{ fontSize: "1.5rem" }}>Log</h1>
```

Only change the text content `Bulk Log` → `Log`. Leave the `<h1>` styling and all surrounding code untouched.

**Verify**: `npm run lint` → exit 0 with no errors.

**Verify**: `Select-String -LiteralPath "src/app/log-egg/page.tsx" -Pattern "Bulk Log"` → no output (no matches).

### Step 2: Update glossary in `CONTEXT.md`

Change line 20 from:
```markdown
- **Bulk Log** — the mobile fast-path for egg entry: a single date applies to all entries, all hens are shown in a grid with per-row weight inputs, and eggs are submitted in a single batch. Replaces the old Quick Log.
```
to:
```markdown
- **Log** — the mobile fast-path for egg entry: a single date applies to all entries, all hens are shown in a grid with per-row weight inputs, and eggs are submitted in a single batch. Replaces the old Quick Log.
```

Only change the term name `Bulk Log` → `Log`. Leave the definition text unchanged.

**Verify**: `npm run build` → exit 0.

## Test plan

No tests needed. This is a pure text rename — no logic changes. The repo has no component tests for the log-egg page heading.

To manually verify after starting the dev server (`npm run dev`): navigate to `/log-egg`. The page heading should read "Log" instead of "Bulk Log".

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] `Select-String -LiteralPath "src/app/log-egg/page.tsx" -Pattern "Bulk Log"` returns no matches
- [ ] `Select-String -LiteralPath "CONTEXT.md" -Pattern "Bulk Log"` returns no matches
- [ ] No files outside `src/app/log-egg/page.tsx` and `CONTEXT.md` are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `src/app/log-egg/page.tsx` line 216 doesn't match the "Current state" excerpt (the codebase has drifted since this plan was written).
- `npm run lint` fails after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- This completes the "Bulk Log" → "Log" rename started in plan 019. After this plan, `git grep "Bulk Log"` across the repo should return no results in `src/` or `CONTEXT.md`. The only remaining matches will be in `plans/*.md` (historical records), which are intentionally left unchanged.
- If a future plan renames route paths (e.g. `/log-egg` → `/log`), the `<a href="/log-egg">` in NavMenu and any redirects would need updating too. That is explicitly deferred.
