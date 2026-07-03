# Plan 029: Deduplicate dynamic-list URL formats in chicken profile page

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

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `9f05e7b`, 2026-07-03

## Why this matters

The chicken profile page fetches dynamic lists using underscore-separated URL paths (`origin_sources`, `acquisition_types`), while every other page (roster, admin) uses kebab-case (`origin-sources`, `acquisition-types`). The API route normalizes both via `normalizeType()` (converts `-` to `_` before matching against valid types), so both work — but the inconsistency creates confusion for developers and suggests the normalization layer is masking a drift that will be discovered when someone tries to add a new list type.

## Current state

`src/app/chickens/[id]/page.tsx:92-105` — Uses underscore-separated URLs:

```tsx
const fetchDynamicLists = useCallback(async () => {
  try {
    const [breedsRes, originsRes, acquisitionsRes] = await Promise.all([
      fetch("/api/dynamic-lists/breeds"),
      fetch("/api/dynamic-lists/origin_sources"),         // ← underscore
      fetch("/api/dynamic-lists/acquisition_types"),       // ← underscore
    ]);
    if (breedsRes.ok) setBreeds(await breedsRes.json());
    if (originsRes.ok) setOriginSources(await originsRes.json());
    if (acquisitionsRes.ok) setAcquisitionTypes(await acquisitionsRes.json());
  } catch {
    // ignore
  }
}, []);
```

Other pages use kebab-case consistently:
- `src/app/roster/page.tsx:98-99`: `"origin-sources"`, `"acquisition-types"`
- `src/app/admin/page.tsx:20-23`: `"origin-sources"`, `"acquisition-types"`

The API route (`src/app/api/dynamic-lists/[type]/route.ts:14-18`) normalizes both formats:

```tsx
const VALID_TYPES: DynamicListType[] = ["breeds", "origin_sources", "acquisition_types"];

function normalizeType(raw: string): DynamicListType | null {
  const t = raw.replace(/-/g, "_");
  if (VALID_TYPES.includes(t as DynamicListType)) return t as DynamicListType;
  return null;
}
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope**:
- `src/app/chickens/[id]/page.tsx` — change two URL strings

**Out of scope**:
- Any other file
- The API route (it handles both formats, no change needed)

## Git workflow

- Branch: `improve/029-deduplicate-dynamic-list-urls`
- Commit: `refactor: use kebab-case dynamic-list URLs in chicken profile for consistency`
- Do NOT push or open a PR

## Steps

### Step 1: Update URL format

In `src/app/chickens/[id]/page.tsx`, lines 96-97, change:

```tsx
fetch("/api/dynamic-lists/origin_sources"),
fetch("/api/dynamic-lists/acquisition_types"),
```

to:

```tsx
fetch("/api/dynamic-lists/origin-sources"),
fetch("/api/dynamic-lists/acquisition-types"),
```

**Verify**: `npm run build` exits 0. `grep "origin_sources" src/app/chickens/\[id\]/page.tsx` and `grep "acquisition_types" src/app/chickens/\[id\]/page.tsx` both return no matches.

## Test plan

No behavioral change — the API normalizes both formats, and the URL paths are only used for internal fetches. If integration tests exist for the chicken profile page, they would pass without changes.

Verify manually: navigate to a chicken profile, confirm the page loads and the edit form's breed/origin/acquisition dropdowns are populated (this proves the fetches succeeded with the new URLs).

## Done criteria

- [ ] `npm run build` exits 0
- [ ] `grep "origin_sources" src/app/chickens/\[id\]/page.tsx` returns no matches
- [ ] `grep "acquisition_types" src/app/chickens/\[id\]/page.tsx` returns no matches
- [ ] URL paths use `origin-sources` and `acquisition-types` (kebab-case)

## STOP conditions

- If the API route's `normalizeType` function has been changed to NOT handle kebab-case (unlikely but check), stop and verify.
- If the chicken profile page has been significantly rewritten, stop and report.

## Maintenance notes

- The API route's `normalizeType` conversion from `-` to `_` remains useful for forward compatibility — it allows both URL conventions, but the codebase should standardize on one. This plan picks kebab-case to match the majority of callers.
- If a new dynamic list type is added, register it in `VALID_TYPES` with underscore (the canonical form in the route) and use kebab-case in all client URLs.
