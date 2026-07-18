# Plan 032 — Phase Results

Plan: `plans/032-major-deps-upgrade.md`
Worktree: `C:\Users\dunca\Documents\code\Chicken-upgrade-deps`
Branch: `improve/032-major-deps`

Track green-build evidence at the end of each phase. Paste the final 10 lines of `npm run build` and the `Tests: X passed` line from `npm run test:all`.

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

Node 22 LTS is the runtime target. Local env already runs Node 26.5.0, well above the floor. Dockerfile `node:22-alpine` bump is queued for Phase 9.

### 0.4 Verification scratch

This file.
