# Plan 032 — Phase Results

Plan: `plans/032-major-deps-upgrade.md`
Worktree: `C:\Users\dunca\Documents\code\Chicken-upgrade-deps`
Branch: `improve/032-major-deps`

Track green-build evidence at the end of each phase. Paste the final 10 lines of `npm run build` and the `Tests: X passed` line from `npm run test:all`.

## Phase reordering

The plan as written ordered Phase 1 (TypeScript 7) before Phase 3 (Next 16). **This is unworkable**: TypeScript 7.0.2 is incompatible with Next.js 14.2.35. The Next TS plugin's type analysis fails under TS 7, which breaks webpack module resolution — the `@/` path alias stops resolving, and the build dies on the first import of any local module.

Confirmed by bisect on a fresh worktree at `4c20204`:

| typescript | next     | `npm run build` |
|------------|----------|-----------------|
| 5.6.3      | 14.2.35  | green           |
| 7.0.2      | 14.2.35  | red             |

The worktree was reset to clean before reordering. **The new phase order is:**

- **Phase 1 (was 3):** Next.js 14 → 16 + ESLint 8 → 10 + `eslint-config-next` 14 → 16
- **Phase 2 (was 1):** TypeScript 5 → 7 + `@types/node` 20 → 26
- **Phase 3 (was 4):** MUI 6 → 9 + x-charts 7 → 8 + x-date-pickers 7 → 8
- **Phase 4 (was 5):** `date-fns` 2 → 4 + picker adapter split
- **Phase 5 (was 6):** `mssql` 11 → 12, drop `@types/mssql`
- **Phase 6 (was 7):** Jest 29 → 30
- **Phase 7 (was 8):** `next-auth` v4 → v5
- **Phase 8 (was 9):** Cleanup — Dockerfile, compose, .dockerignore, docs

The plan's prose phase numbers in `plans/032-major-deps-upgrade.md` are now out of date. They have not been edited — this scratch doc is the source of truth for what was actually executed.

---

## Phase 0 — Pre-flight

**Date:** 2026-07-18
**Node:** v26.5.0
**npm:** 11.17.0

### 0.1 Baseline (run from main checkout at `25283bd`)

`npm install` — green (sharp reinstalled; pre-existing empty `node_modules/sharp` dir caused webpack `Can't resolve 'sharp'` on first build)

`npm run build` — green. Tail of output:

```
├ ƒ /api/chickens/[id]/photos/[photoId]/primary  0 B                0 B
├ ƒ /api/dynamic-lists/[type]                    0 B                0 B
├ ƒ /api/dynamic-lists/[type]/merge              0 B                0 B
├ ƒ /api/eggs                                    0 B                0 B
├ ƒ /api/eggs/[id]                               0 B                0 B
├ ○ /api/health                                  0 B                0 B
├ ƒ /api/photos/[filename]                       0 B                0 B
├ ○ /auth/error                                  2.26 kB         128 kB
├ ƒ /chickens/[id]                               16.4 kB         375 kB
├ ○ /dashboard                                   462 B          87.9 kB
├ ○ /dashboard/eggs                              4.82 kB         206 kB
├ ○ /egg-history                                 4.13 kB         313 kB
├ ○ /log-egg                                     5.83 kB         349 kB
├ ○ /roster                                      7.63 kB         279 kB
├ ○ /roster/enrol                                5.58 kB         345 kB
└ ○ /unauthorized                                1.05 kB         126 kB
+ First Load JS shared by all                    87.4 kB
```

`npm run test:all` — `Tests: 82 passed, 82 total` (unit/integration, 7 suites) and `Tests: 20 passed, 20 total` (component, 5 suites). 102 total.

`npm run lint` — `No ESLint warnings or errors`.

### 0.2 Worktree

- Branch `improve/032-major-deps` created from HEAD (`25283bd`).
- Worktree at `C:\Users\dunca\Documents\code\Chicken-upgrade-deps`.
- `.env` copied from main checkout.

### 0.3 Node engines target

`package.json` updated:

```json
"engines": {
  "node": ">=20.9.0"
}
```

Node 22 LTS is the runtime target. Local env already runs Node 26.5.0, well above the floor. Dockerfile `node:22-alpine` bump is queued for Phase 8 (cleanup).

### 0.4 Verification scratch

This file.
