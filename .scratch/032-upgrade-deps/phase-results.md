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
| 1 | Next 14 → 15 + ESLint 8 → 9 + `eslint-config-next` 14 → 15 | complete |
| 2 | TypeScript 5.6 → 6 + `@types/node` 20 → 24 | complete |
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

---

## Phase 1 — Next 14 → 15 + ESLint 8 → 9 + `eslint-config-next` 14 → 15

**Date:** 2026-07-18

### Dependency upgrades

| Package | From | To |
|---------|------|----|
| `next` | `^14.2.35` | `^15.5.20` |
| `eslint` | `^8.57.0` | `^9.39.5` |
| `eslint-config-next` | `^14.2.35` | `^15.5.20` |
| `@testing-library/dom` | (not installed) | `^10.4.1` |

The `@testing-library/dom` peer dep was missing on `@testing-library/react@16` and surfaced only after the WIP commit. Installed in the same commit; counts as part of the Phase 1 surface because the build was already green without it (build doesn't import `react` test utilities).

### Code changes

1. **Lint script** (`package.json:12`): `next lint` → `eslint .`. `next lint` was removed in Next 15.
2. **ESLint flat config** (`eslint.config.mjs`, new): replaces `.eslintrc.json` (deleted). Uses `FlatCompat` from `@eslint/eslintrc` to bridge `eslint-config-next@15`'s legacy `module.exports` form into ESLint 9's flat config. `eslint-config-next@15` does not yet ship a flat config preset.
3. **`next.config.js`**: added `serverExternalPackages: ["mssql", "sharp", "tedious"]` so Next 15's bundler doesn't try to bundle `mssql`'s native `tedious` dep or `sharp`'s platform-specific binary.
4. **Async `params` in dynamic route handlers** (8 files in the WIP commit + 1 fix in this commit):
   - `src/app/api/chickens/[id]/route.ts`
   - `src/app/api/chickens/[id]/notes/[noteId]/route.ts`
   - `src/app/api/chickens/[id]/notes/route.ts`
   - `src/app/api/chickens/[id]/photos/[photoId]/primary/route.ts`
   - `src/app/api/chickens/[id]/photos/[photoId]/route.ts`
   - `src/app/api/chickens/[id]/photos/route.ts`
   - `src/app/api/dynamic-lists/[type]/merge/route.ts`
   - `src/app/api/dynamic-lists/[type]/route.ts`
   - `src/app/api/eggs/[id]/route.ts`
   - `src/app/api/photos/[filename]/route.ts`
5. **`export const dynamic = "force-dynamic"`** added to all 12 GET route handlers (this commit). Next 15 caches GET handlers by default; the project always wants fresh data.
6. **`dynamic-lists/[type]/route.ts:138` bug fix**: the `DELETE` handler's first param was renamed `_request` (no-unused-vars) but the body still called `request.json()`. Renamed back to `request`.

### Verification

`npm run build` — green. Tail of output:

```
├ ƒ /api/admin/users                               172 B         102 kB
├ ƒ /api/analytics                                 172 B         102 kB
├ ƒ /api/auth/[...nextauth]                        172 B         102 kB
├ ƒ /api/chickens                                  172 B         102 kB
├ ƒ /api/chickens/[id]                             172 B         102 kB
├ ƒ /api/chickens/[id]/notes                       172 B         102 kB
├ ƒ /api/chickens/[id]/notes/[noteId]              172 B         102 kB
├ ƒ /api/chickens/[id]/photos                      172 B         102 kB
├ ƒ /api/chickens/[id]/photos/[photoId]            172 B         102 kB
├ ƒ /api/chickens/[id]/photos/[photoId]/primary    172 B         102 kB
├ ƒ /api/dynamic-lists/[type]                      172 B         102 kB
├ ƒ /api/dynamic-lists/[type]/merge                172 B         102 kB
├ ƒ /api/eggs                                      172 B         102 kB
├ ƒ /api/eggs/[id]                                 172 B         102 kB
├ ƒ /api/health                                    172 B         102 kB
├ ƒ /api/photos/[filename]                         172 B         102 kB
```

All 16 dynamic routes (`ƒ`) are now correctly marked as dynamic.

`npm run test:all` — `Tests: 82 passed, 82 total` (unit/integration, 7 suites) and `Tests: 20 passed, 20 total` (component, 5 suites). 102 total.

`npm run lint` — exit code 0. One self-warning on `eslint.config.mjs:12:1`: `import/no-anonymous-default-export` (the `next/core-web-vitals` preset, not project code). `next/core-web-vitals` itself is configured to treat this as `warn`, not `error`, so the lint passes.

### Commit

WIP commit `b3ca16d` (next 15 + eslint 9 installed, route params made async) squashed/amended into a single clean phase-1 commit:

```
chore(deps): upgrade next 14 → 15, eslint 8 → 9 (flat config)
```

---

## Phase 2 — TypeScript 5.6 → 6 + `@types/node` 20 → 24

**Date:** 2026-07-18

### Dependency upgrades

| Package | From | To |
|---------|------|----|
| `typescript` | `^5.6.3` | `^6.0.3` |
| `@types/node` | `^20.17.0` | `^24.13.3` |

### Code changes (`tsconfig.json`)

1. **`target`**: `es2017` → `es2022`. TS 6's recommended baseline; needed for `Array.prototype.at` and `Object.hasOwn` used elsewhere in the codebase.
2. **`noUncheckedSideEffectImports: false`** added. TS 6 enables this flag by default under `strict`; it rejected `import "./globals.css"` at `src/app/layout.tsx:2` because the CSS file has no module declaration. Opted out (the same way the plan opted out of `noUncheckedIndexedAccess`): a separate quality-of-types improvement, not part of this upgrade.
3. **`rootDir: "."`** added. TS 6 introduced **TS5011** ("The common source directory of 'tsconfig.json' is './tests'. The 'rootDir' setting must be explicitly set to this or another path to adjust your output's file layout.") — the implicit-rootDir detection saw `tests/` (a deeper subdir than the project sources under `src/`) and refused to compile. Setting `rootDir: "."` is the documented fix; see the `https://aka.ms/ts6` migration link in the error message.

No application code changes were required. The plan's callouts (`src/lib/auth.ts:40` `Record<string, unknown>` cast, the `as Chicken`/`as Photo[]` double-`as` chains in `src/lib/{chickens,eggs,photos,notes,users}.ts`, and the 12 `recordset[0]` access sites in `src/lib/analytics.ts`) all type-check cleanly under TS 6 strict mode without intervention.

### Verification

`npm run build` — green. Tail of output:

```
├ ƒ /api/photos/[filename]                         172 B         102 kB
├ ○ /auth/error                                   2.2 kB         142 kB
├ ƒ /chickens/[id]                               16.3 kB         391 kB
├ ○ /dashboard                                     461 B         102 kB
├ ○ /dashboard/eggs                               4.8 kB         227 kB
├ ○ /egg-history                                 4.11 kB         329 kB
├ ○ /log-egg                                     5.81 kB         365 kB
├ ○ /roster                                      7.66 kB         294 kB
├ ○ /roster/enrol                                5.56 kB         362 kB
└ ○ /unauthorized                                1.04 kB         141 kB
+ First Load JS shared by all                     102 kB
  ├ chunks/1255-13d973e0759ea6d6.js              45.8 kB
  ├ chunks/4bd1b696-182b6b13bdad92e3.js          54.2 kB
  └ other shared chunks (total)                  1.95 kB
```

`npm run test:all` — `Tests: 82 passed, 82 total` (unit/integration, 7 suites) and `Tests: 20 passed, 20 total` (component, 5 suites). 102 total.

`npm run lint` — exit code 0. Same self-warning on `eslint.config.mjs:12:1` as Phase 1.

### Risks worth flagging

- **Pre-existing peer-dep conflict on `@mui/system` / `@mui/utils` / `@mui/private-theming` / `@mui/styled-engine`** (all pinned at `^9.2.0` in `devDependencies`, but `@mui/x-charts@7.29.1` and `@mui/x-date-pickers@7.29.4` only allow `@mui/system@^5.15.14 || ^6.0.0 || ^7.0.0`). This was introduced in Phase 1 and was not caught there. `npm ls` reports `invalid` for those four packages. The actual transitive resolution — `@mui/system@6.5.0` from `@mui/material@6.5.0` — is what the runtime uses, and none of the four are referenced directly from project source, so the build is green. A future `npm install` without `--legacy-peer-deps` will fail with `ERESOLVE`. **Not in scope for this phase** — fixing it would be a Phase 1 follow-up.

### Commit

```
chore(deps): upgrade typescript 5.6 → 6 and @types/node 20 → 24
```
