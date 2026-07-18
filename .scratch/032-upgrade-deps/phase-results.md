# Plan 032 — Phase Results

Plan: `plans/032-major-deps-upgrade.md`
Worktree: `C:\Users\dunca\Documents\code\Chicken-upgrade-deps`
Branch: `improve/032-major-deps`

Track green-build evidence at the end of each phase. Paste the final 10 lines of `npm run build` and the `Tests: X passed` line from `npm run test:all`.

## Why the plan was reworked mid-execution

The original plan targeted the **absolute-latest** stack: Next 16, React 19, TypeScript 7, ESLint 10, MUI 9, x-charts 8, x-date-pickers 8, Jest 30, date-fns 4, mssql 12, next-auth 5. Two failures during Phase 1 of execution proved the plugin ecosystem is not caught up with that target stack:

**Failure 1: TypeScript 7.0.2 is incompatible with Next.js 14.2.35.** The Next TS plugin's type analysis fails under TS 7, which breaks webpack module resolution — the `@/` path alias stops resolving, and the build dies on the first import of any local module. Confirmed by bisect on a fresh worktree at `4c20204`:

| typescript | next     | `npm run build` |
|------------|----------|-----------------|
| 5.6.3      | 14.2.35  | green           |
| 7.0.2      | 14.2.35  | red             |

**Failure 2: ESLint 10 is incompatible with `eslint-plugin-react@7.37.5`.** The latest `eslint-plugin-react` caps its peer dep at `eslint ^9.7`, so ESLint 10 cannot load `react/display-name`. Confirmed by bisect: eslint 9.36.0 works, eslint 10.7.0 throws `contextOrFilename.getFilename is not a function`.

Per user direction (2026-07-18), the plan was reworked to **one major version less than the latest stable** for every component, and the absolute-latest target was dropped. Where the rework lands on a version the project is already on, that phase is a no-op and was dropped.

## Final reworked plan (source of truth for execution)

| Phase | What | Status |
|-------|------|--------|
| 1 | Next 14 → 15 + ESLint 8 → 9 + `eslint-config-next` 14 → 15 | in progress |
| 2 | TypeScript 5.6 → 6 + `@types/node` 20 → 24 | pending |
| 3 | MUI 6 → 7; `@mui/x-charts` and `@mui/x-date-pickers` already at 7 | pending |
| 4 | `date-fns` 2 → 3 + `@mui/x-date-pickers` adapter split | pending |
| 5 | Cleanup — Dockerfile, compose, .env, .dockerignore, docs | pending |

**Dropped (project is already at the rework's target version):**

- React 18 → 19 — project is on 18.3.1 (latest 18.x).
- Jest 29 → 30 — project is on 29.7.0 (latest 29.x).
- mssql 11 → 12 — project is on 11.0.1 (latest 11.x; staying on 11 is fine).
- next-auth 4 → 5 — `next-auth@5.0.0-beta.31` is still beta in 2026-07; project stays on stable 4.24.14.
- `@mui/x-charts` 7 → 8 and `@mui/x-date-pickers` 7 → 8 — project is already on the latest 7.x of both.

The plan file `plans/032-major-deps-upgrade.md` has been edited in-place to reflect the rework. Its header now records the rework rationale, the original vs. reworked target stacks, and the dropped phases.

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

Node 22 LTS is the runtime target. Local env already runs Node 26.5.0, well above the floor. Dockerfile `node:22-alpine` bump is queued for Phase 5 (cleanup).

### 0.4 Verification scratch

This file.
