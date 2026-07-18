# Plan 032 — Major-version dependency upgrade

**Generated:** 2026-07-18
**Status:** IN PROGRESS — reworked mid-execution (2026-07-18)
**Original target stack:** Next 16, React 19, TypeScript 7, MUI 9 (+ x-charts 8, x-date-pickers 8), ESLint 10, Jest 30, date-fns 4, mssql 12, next-auth 5
**Reworked target stack (latest-1):** Next 15, React 18.3 (no upgrade), TypeScript 6, MUI 7 (+ x-charts 7, x-date-pickers 7 — already at 7), ESLint 9, Jest 29 (no upgrade), date-fns 3, mssql 11 (no upgrade), next-auth 4 (no upgrade), @types/node 24
**Current stack:** Next 14.2, React 18.3, TypeScript 5.6, MUI 6.5 (+ x-charts 7, x-date-pickers 7), ESLint 8.57, Jest 29, date-fns 2.30, mssql 11, next-auth 4.24

> **Read this first.** This plan is the result of `npx npm-check-updates` + a full codebase survey. The survey findings live in the planning notes — every "Ref" below is `file:line`. The plan deliberately sequences work so each phase ends at a green build + green tests. Do not collapse phases into a single commit; the diff would be un-reviewable.
>
> **Why reworked mid-execution.** Phase 1 (TypeScript 7) was the original first phase. The build failed immediately under TypeScript 7.0.2 against Next.js 14.2.35 — the Next TS plugin's type analysis breaks, which cascades into webpack failing to resolve the `@/` path alias. Confirmed by bisect: TS 5.6.3 builds green, TS 7.0.2 fails. ESLint 10 has a parallel problem: `eslint-plugin-react@7.37.5` (the latest) caps its peer dep at `eslint ^9.7`, so ESLint 10 cannot load `react/display-name`. These are signs that the absolute-latest stack (Next 16, React 19, TS 7, ESLint 10, MUI 9) is bleeding-edge: the plugin ecosystem has not caught up. Per user direction (2026-07-18), the stack was reworked to **one major version less than the latest stable** for every component where the latest has plugin-ecosystem gaps. Where that lands on a version the project is already on (Jest 29, mssql 11, next-auth 4, react 18.3), the upgrade is a no-op and the phase is dropped.
>
> **Reality check.** Where the plan says "X.Y", read it as "the most recent X.Y at execution time". Versions that the executor should `npm view` to confirm: Next 15, ESLint 9, MUI 7, TypeScript 6, @types/node 24, date-fns 3.

---

## 0. Pre-flight

**0.1 Confirm the current baseline is green.** Before touching anything:

```bash
npm install
npm run build
npm run test:all
npm run lint
```

If any of these fail on the current `main`, fix that first. A clean baseline is the only way to know which phase broke what.

**0.2 Set up a worktree per `CLAUDE.md`'s `improve` workflow.** Branch and worktree:

```bash
git branch improve/032-major-deps HEAD
git worktree add ../Chicken-upgrade-deps improve/032-major-deps
Copy-Item "$(git rev-parse --show-toplevel)\.env" "$(Resolve-Path '..\Chicken-upgrade-deps')\.env"
```

All phase work happens in that worktree. Do **not** delete it after review.

**0.3 Set a Node version target.** Next 15 requires Node ≥ 18.18. Pick one and stick to it: **Node 22 LTS** is the safe target for 2026. Update `package.json` with:

```json
"engines": { "node": ">=20.9.0" }
```

(Update the Dockerfile to `FROM node:22-alpine` in the final phase — flagged in §5.)

**0.4 Create a verification scratch file.** Track green-build evidence at the end of each phase:

```
.scratch/032-upgrade-deps/phase-results.md
```

After each phase, paste the final 10 lines of `npm run build` and the `Tests: X passed` line from `npm run test:all`.

---

## Phase dependency graph (reworked)

```
Phase 1 (Next 14 → 15 + ESLint 8 → 9 + eslint-config-next 14 → 15)
  └─> Phase 2 (TypeScript 5.6 → 6 + @types/node 20 → 24)
        └─> Phase 3 (MUI 6 → 7; x-charts/x-date-pickers already at 7)
              └─> Phase 4 (date-fns 2 → 3 + picker adapter split)
                    └─> Phase 5 (Cleanup: Dockerfile, compose, .env, .dockerignore, docs)
```

**Dropped from the original plan because the project is already at the rework's target version:**

- React 18 → 19 — project is on 18.3.1 (latest 18.x); no upgrade needed.
- Jest 29 → 30 — project is on 29.7.0 (latest 29.x); no upgrade needed.
- mssql 11 → 12 — project is on 11.0.1 (latest 11.x; mssql jumped to 12 but staying on 11 is fine).
- next-auth 4 → 5 — `next-auth@5.0.0-beta.31` is still beta in 2026-07; project stays on stable 4.24.14.
- `@mui/x-charts` 7 → 8, `@mui/x-date-pickers` 7 → 8 — project is already on the latest 7.x of both. No upgrade needed.

**Why the rework is the right call (recap):**

- The original plan targeted absolute-latest (Next 16, React 19, TS 7, ESLint 10, MUI 9). The plugin ecosystem is not caught up: Next 16 + TS 7 breaks the `@/` alias resolution at the webpack layer; ESLint 10 is incompatible with `eslint-plugin-react@7.37.5` (the latest, whose peer dep caps at `eslint ^9.7`).
- The rework targets one major less than the latest, which lands on the most recent version that has a stable plugin ecosystem. Where the rework lands on a version the project is already on, the upgrade is a no-op and the phase is dropped.

Phases 3 and 4 are independent of Phase 2 (TypeScript 6) in principle — the MUI 7 / date-fns 3 work is mostly code-side, not types-side — but doing them in order keeps each commit small and reviewable.

---

## Phase 1 — Next.js 14 → 15 + ESLint 8 → 9 + `eslint-config-next` 14 → 15

**Why first:** The Next 14 → 15 jump is the largest single change in this reworked plan. It unblocks the Async-by-default route params migration, the `next lint` deprecation (which forces the flat-config rewrite), and the React 19 peer (Next 15 supports both React 18 and 19). Doing it first means the rest of the rework is layered on a stable build.

**Steps**

1. `npm install next@^15.5.20`
2. `npm install --save-dev eslint@^9.39.5 eslint-config-next@^15.5.20`
3. **Remove** `next lint` from the `lint` script. In `package.json:9`, change:
   ```json
   "lint": "next lint"
   ```
   to:
   ```json
   "lint": "eslint ."
   ```
4. **Delete** `.eslintrc.json`. It is 3 lines (`{"extends": "next/core-web-vitals"}`). Replace it with a flat `eslint.config.mjs`:
   ```js
   import nextConfig from "eslint-config-next/core-web-vitals";
   export default [...nextConfig];
   ```
   `eslint-config-next@15.5.20` ships a flat-config preset via its `core-web-vitals` subpath, so the flat-config rewrite is one import. (Verified: the package's `dist/core-web-vitals.js` exports an array of `Linter.Config[]`.)
5. **Update `next.config.js`** (Ref: `next.config.js:1-6`):
   - Add `serverExternalPackages: ["mssql", "sharp", "tedious"]` — needed because `mssql` depends on native `tedious` and `sharp` is ESM-only with platform-specific binaries. Without this, Next 15's bundler will choke on them.
   - Verify `output: "standalone"` still works (the Dockerfile depends on it at `Dockerfile:23`).
6. **Async-by-default route params.** Next 15 made `params` async in route handlers. The project has 7 dynamic route handlers — verify they accept `await`:
   - `src/app/api/chickens/[id]/route.ts` — uses `params.id`
   - `src/app/api/chickens/[id]/notes/[noteId]/route.ts`
   - `src/app/api/chickens/[id]/photos/[photoId]/route.ts`
   - `src/app/api/chickens/[id]/photos/[photoId]/primary/route.ts`
   - `src/app/api/dynamic-lists/[type]/route.ts` — uses `params.type`
   - `src/app/api/dynamic-lists/[type]/merge/route.ts`
   - `src/app/api/photos/[filename]/route.ts` — uses `params.filename`
   
   Each handler signature must change from `(req, { params }: { params: { id: string } })` to `(req, { params }: Promise<{ id: string }>)` and then `const { id } = await params;`. **Touch all 7 of these files.** Use a grep for `params\.[a-z]+` in `src/app/api/` to confirm none are missed.
7. **Async `cookies()` and `headers()`.** Next 15 made these async. The `getServerSession` call sites in 14 API routes already pull these via `getServerSession`, so they don't need to change. **But** if any of the 14 routes call `cookies()` or `headers()` directly outside of `getServerSession`, those need to be `await`ed. **Verify** with:
   ```bash
   grep -rn "cookies()\|headers()" src/app/
   ```
   If any are unawaited, fix them in this phase.
8. **Caching defaults.** Next 15 caches GET route handlers by default. The project has GET handlers that depend on the DB (`/api/eggs`, `/api/chickens`, `/api/analytics`, `/api/dynamic-lists/*`). Add `export const dynamic = "force-dynamic";` to each so they always serve fresh data — appropriate for a LAN app.
9. Run `npm run build && npm run test:all && npm run lint`.
10. **Expected outcome:** Build green, all tests pass, lint runs (may surface new warnings from the upgraded ESLint — fix them as part of this phase, don't defer).

**Commit message:** `chore(deps): upgrade next 14 → 15, eslint 8 → 9 (flat config)`

**STOP condition:** Build, test:all, and lint all green. `.scratch/032-upgrade-deps/phase-results.md` updated.

---

## Phase 2 — TypeScript 5.6 → 6 + `@types/node` 20 → 24

**Why second:** Now that Next 15 is in, the TypeScript upgrade lands cleanly. TS 6 is a real major (introducing stricter inference, faster incremental builds) but is widely deployed by 2026-07; it does not have the Next-TS-plugin compatibility gap that TS 7 hit.

**Steps**

1. `npm install --save-dev typescript@^6.0.3 @types/node@^24.13.3`
2. Edit `tsconfig.json`:
   - `target`: bump `es2017` → `es2022` (TS 6's recommended baseline; required for `Array.prototype.at`, `Object.hasOwn`).
   - Keep `module: "esnext"`, `moduleResolution: "bundler"`, `strict: true`, `isolatedModules: true`.
   - Do **not** add `noUncheckedIndexedAccess` — separate quality improvement, out of scope here.
3. If TS 6 surfaces new type errors, fix them in this phase. Likely sites to watch:
   - `src/lib/auth.ts:40` — `(session.user as Record<string, unknown>).role = token.role` may now warn about an unsafe cast through `Record<string, unknown>`. Refactor to a typed local var.
   - `src/lib/{chickens,eggs,photos,notes,users}.ts` — `as Chicken`, `as Photo[]` double-`as` chains. TS 6 may reject them; narrow with a runtime check or `as unknown as T`.
   - `src/lib/analytics.ts:128, 157, 185, 214, 243, 275, 307, 355, 394, 423, 461, 498, 511` — `recordset[0]` access. If TS 6 enables `noUncheckedIndexedAccess` by default in `strict` mode, opt out with `"noUncheckedIndexedAccess": false`.
4. `next-env.d.ts` (Ref: `next-env.d.ts:1-5`) — Next 15 keeps the same `./.next/types/routes.d.ts` shape. No change.
5. Run:
   ```bash
   npm run build
   npm run test:all
   ```

**Commit message:** `chore(deps): upgrade typescript 5.6 → 6 and @types/node 20 → 24`

**STOP condition:** `npm run build` and `npm run test:all` both green. `.scratch/032-upgrade-deps/phase-results.md` updated.

---

## Phase 3 — MUI 6 → 7

**Why third:** MUI 7 is the version that the project's `x-charts@7.x` and `x-date-pickers@7.x` are designed against. Both are already on the latest 7.x, so this phase is only the `@mui/material` and `@mui/icons-material` core bump, plus the `Grid2 as Grid` rename (which becomes a no-op in MUI 7 since `Grid` in v7 IS the v6 `Grid2`).

**Steps**

1. `npm install @mui/material@^7.3.11 @mui/icons-material@^7.3.11`
   (`@mui/x-charts@7.29.1` and `@mui/x-date-pickers@7.29.4` are already at the latest 7.x — no change.)
2. **`Grid2 as Grid` rename — 3 files:**
   - `src/app/page.tsx:18` — change `import { ..., Grid2 as Grid, ... }` → `import { ..., Grid, ... }`
   - `src/app/log-egg/page.tsx:21` — same
   - `src/app/chickens/[id]/page.tsx:38` — same
   
   The `<Grid size={{ xs, sm }}>` prop syntax is unchanged. The 7 call sites listed in the survey (page.tsx:283, 294; log-egg/page.tsx:412-414; chickens/[id]/page.tsx:1093, 1094, 1100, 1106, 1112) work as-is.
3. **Run the MUI v6→v7 codemod before manual edits** — it handles most prop migrations automatically:
   ```bash
   npx @mui/codemod v7.0.0/preset-safe src/
   ```
4. **Deprecated prop migrations (hand-reviewed after the codemod):**
   - `src/components/AppShell.tsx:111` — `ModalProps={{ keepMounted: true }}` → `slotProps={{ root: { keepMounted: true } }}`
   - `src/components/ChickenTableRow.tsx:186` — `InputLabelProps={{ shrink: true }}` → `slotProps={{ inputLabel: { shrink: true } }}`
   - `src/components/HenRow.tsx:73` — `inputProps={...}` → `slotProps={{ htmlInput: ... }}`
   - `src/app/egg-history/page.tsx:256, 267` — same `inputProps` → `slotProps.htmlInput`
   - `src/app/log-egg/page.tsx:529, 540` — same
   - `src/components/UserMenu.tsx:55` — `MenuListProps={{ "aria-label": ... }}` → `slotProps={{ list: { "aria-label": ... } }}`
   - `src/components/ThemeToggle.tsx:75` — same `MenuListProps` → `slotProps.list`
   - `src/app/chickens/[id]/page.tsx:1402` — `ListItem.secondaryAction={...}` → `slotProps={{ secondaryAction: ... }}` (MUI 7 syntax; v9 alternative was to wrap, but v7 uses slots).
5. **ImageList deprecation** (MUI v7 deprecates, may remove later): `src/app/chickens/[id]/page.tsx:33-34, 1148, 1152, 1244, 1247`. v7 still has `ImageList`, so no change. If a later MUI 7 patch removes it, run the codemod:
   ```bash
   npx @mui/codemod v7.0.0/image-list src/app/chickens
   ```
6. **x-charts `onItemClick` deprecation** (Ref: `src/app/page.tsx:363, 513`): Not applicable in MUI x-charts 7.x. The v7→v8 codemod (which is what renames this) only runs when upgrading x-charts past 7, and we're not doing that.
7. **Add `AppRouterCacheProvider`** to `src/app/providers.tsx` (Ref: `src/app/providers.tsx:1-34`) — required for MUI/Emotion SSR styles to flush correctly under Next 15's App Router:
   ```bash
   npm install @mui/material-nextjs@^7.3.11
   ```
   ```tsx
   "use client";
   import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
   // ... other imports ...
   export function Providers({ children }: { children: React.ReactNode }) {
     return (
       <AppRouterCacheProvider>
         <SessionProvider>
           <ThemeModeProvider>
             <CssBaseline />
             <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={getDateFnsLocale()}>
               <QueryClientProvider client={queryClient}>
                 {children}
               </QueryClientProvider>
             </LocalizationProvider>
           </ThemeModeProvider>
         </SessionProvider>
       </AppRouterCacheProvider>
     );
   }
   ```
   `AppRouterCacheProvider` is the **outermost** wrapper.
8. The server-vs-client warning at `src/app/auth/error/page.tsx` and `src/app/unauthorized/page.tsx` (importing `@mui/icons-material/ArrowBackIcon` from a server component) was a Next 16 / React 19 issue. With Next 15 + React 18 it may or may not appear — verify in the build output. If it does, the simplest fix is `src/components/BackButton.tsx` (a thin `"use client"` wrapper around `Button + ArrowBackIcon`).
9. Run `npm run build && npm run test:all && npm run lint`.
10. **Expected outcome:** Build green, tests pass. Component tests that render MUI components (AppShell, NavMenu, UserMenu, HealthIndicator, RosterPage) all use the render utilities at `tests/components/test-utils.tsx:1-30` — verify the `renderWithProviders` helper still wraps everything correctly with the new `AppRouterCacheProvider` added.

**Commit message:** `chore(deps): upgrade @mui/material 6 → 7 (x-charts and x-date-pickers already at 7)`

**STOP condition:** Build, test:all, and lint all green. Component tests must be green (5 suites per the README).

---

## Phase 4 — `date-fns` 2 → 3 + `@mui/x-date-pickers` adapter split

**Why after MUI:** The adapter change (`AdapterDateFns` → `AdapterDateFnsV3`) is contingent on the picker being at v7+, which it now is (and was before this phase). Doing it in its own phase keeps the diff focused on date-fns.

**Steps**

1. `npm install date-fns@^3.6.0`
2. **Verify the locale imports** in `src/lib/dateUtils.ts:1-58` against the date-fns v3 locale list. The list currently imports: `enUS, enGB, enAU, enCA, enNZ, enZA, enIE, enIN, de, deAT, fr, frCA, frCH, es, it, itCH, pt, ptBR, nl, nlBE, sv, nb, nn, da, fi, pl, ru, uk, ja, zhCN, zhTW, zhHK, ko, ar, arSA, arEG, hi, tr, vi, th, id, ms, he, el, hu, cs, sk, ro, bg, hr, sr, srLatn, sl, lt, lv, et`.
   
   date-fns v3 renamed some locales — the most likely breakage is one of the Cyrillic or right-to-left locales. The date-fns v3 migration guide (https://git.io/fxCyr) is the authoritative reference. If a locale name changed, update the import.
3. **Replace the date-fns adapter** in `src/app/providers.tsx:8-9` and `tests/components/test-utils.tsx:4-5`:
   - Remove: `import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";`
   - Add: `import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";`
4. The `Locale` type import at `src/lib/dateUtils.ts:59` — `import type { Locale } from "date-fns";` — is unchanged. The shape of `Locale` is stable across v2/v3.
5. The `Intl.DateTimeFormat` usage at `src/lib/dateUtils.ts:168-193` is independent of date-fns and needs no change.
6. Run `npm run build && npm run test:all`.
7. **Expected outcome:** Build green, all 102 tests pass. Component tests that exercise `DatePicker` (via the rendered `page.tsx`, `log-egg/page.tsx`, `chickens/[id]/page.tsx`) will exercise the new adapter path — failures will be adapter-shape mismatches, not data mismatches.

**Commit message:** `chore(deps): upgrade date-fns 2 → 3 and switch x-date-pickers to v3 adapter`

**STOP condition:** Build, test:all, and lint all green.

---

## Phase 5 — Cleanup: Dockerfile, compose, .env, .dockerignore, docs

**Why last:** All the version-specific changes are landed; this phase updates the supporting infra and docs.

**Steps**

1. **Dockerfile** (Ref: `Dockerfile:1-28`):
   - `FROM node:20-alpine` → `FROM node:22-alpine` (matches the Node 22 LTS target set in Phase 0.3).
   - Add `COPY eslint.config.mjs ./` (Ref: `Dockerfile:14` — currently only copies `tsconfig.json next.config.js`).
   - No change to the `sharp` install — `npm ci` picks up the platform-specific binary.
2. **`.dockerignore`** (Ref: 6 lines): add `.scratch/`, `plans/`, `coverage/` to reduce build context.
3. **`package.json` `engines` field** (added in Phase 0.3): verify the entry is present.
4. **Update `package.json` `description` / README** (if any) with the new version matrix. The repo's `README.md` (if it has a "Stack" section) should reflect Next 15 / React 18.3 / MUI 7. The `CLAUDE.md` / `CONTEXT.md` should not need version-specific changes — they describe patterns, not versions.
5. **Verify `.scratch/032-upgrade-deps/phase-results.md`** has a green-build line from every phase.
6. Run the full verification one more time:
   ```bash
   npm install
   npm run build
   npm run test:all
   npm run lint
   ```

**Commit message:** `chore(infra): update Dockerfile to Node 22, refresh .dockerignore, add eslint.config.mjs to build context`

**STOP condition:** All four commands green. The `improve/032-major-deps` branch is ready for review.

---

## Risks that may require a follow-up plan

The following are **not** in the plan above because they're either speculative or out-of-scope for a dependency upgrade. Flag them in the PR if they materialize during execution:

1. **TypeScript 6 enables `noUncheckedIndexedAccess` by default** in `strict` mode. If Phase 2's opt-out doesn't work, ~47 `result.recordset[0]` sites in the 8 mssql lib files will need non-null assertions or guard-clause refactors. Estimated effort: 2-4 hours. Best done as a follow-up plan.
2. **MUI 7 deprecates `Grid2 as Grid` in favour of plain `Grid`** — handled in Phase 3 step 2. The 7 `<Grid size={{ xs, sm }}>` call sites work as-is. If a later MUI 7 patch changes the `size` prop syntax, those 7 sites need an update. Quick fix.
3. **Next 15's default caching interacts badly with the existing API routes.** The 7 dynamic GET handlers depend on the DB (`/api/eggs`, `/api/chickens`, `/api/analytics`, `/api/dynamic-lists/*`, etc.) and must opt out of caching with `export const dynamic = "force-dynamic";` (Phase 1 step 8). If any are missed, stale-data symptoms will appear at runtime, not at build time.
4. **`react-easy-crop@6` may break under MUI 7's Emotion 11 version bump** (MUI 7 still uses Emotion 11, so this is unlikely — but worth a smoke test on `/chickens/[id]` after Phase 3 lands). The CropDialog at `src/components/CropDialog.tsx:1-120` is the only consumer.
5. **The `migrationsPromise` top-level call at `src/lib/db.ts:269-271` may be flagged by Next 15's server runtime** as a disallowed top-level await. If so, refactor to a `beforeRequest`-style pattern or move to `middleware.ts`. Out of scope here.

---

## What this plan does NOT do

To keep scope focused, the plan deliberately excludes:

- **Adding `loading.tsx` / `error.tsx` / `not-found.tsx`** to the 8 page directories that lack them. The survey flagged their absence; a separate plan can address it.
- **Enabling `noUncheckedIndexedAccess`** as a quality improvement. The Phase 2 opt-out keeps the upgrade on rails; adopting `noUncheckedIndexedAccess` is its own piece of work.
- **Adding `src/middleware.ts` for edge-auth.** The project does per-route `getServerSession` checks today; introducing middleware is a refactor, not an upgrade.
- **Upgrading to Next 16 / React 19 / TypeScript 7 / ESLint 10 / MUI 9** (the absolute-latest stack this plan originally targeted). Deferred because the plugin ecosystem is not caught up — see the rework note in the header.
- **Switching from CJS to ESM at the package level** (`"type": "module"`). Not needed for any of the reworked targets.
- **Migrating the `palette.ts` MD3 system to MUI 7's built-in tokens.** Major refactor; out of scope.

---

## Verification matrix

Per `CLAUDE.md`'s `improve` workflow, every phase must close with these commands green:

| Command | Purpose |
|---|---|
| `npm run build` | Next 15 build pipeline, route generation, type-check |
| `npm run test` | Jest 29 unit/integration (7 suites, node env) |
| `npm run test:components` | Jest 29 component tests (5 suites, jsdom) |
| `npm run test:all` | Both of the above |
| `npm run lint` | ESLint 9 flat config |
| `npm run test:integration` | Optional — only if a live SQL Server is available in the executor's env |

---

## Reference

- Original plan: `npx npm-check-updates` output captured 2026-07-18 and a full codebase survey (also 2026-07-18). Survey notes: see `.scratch/032-upgrade-deps/survey.md` if generated; otherwise, re-run the survey agent if the codebase has changed since.
- Mid-execution rework: 2026-07-18. Triggered by Phase 1 (TypeScript 7) build failure against Next 14 and ESLint 10 plugin-compatibility failure. See the "Why reworked mid-execution" block in the header for the full rationale, and `.scratch/032-upgrade-deps/phase-results.md` for the evidence.
- All file:line references in this plan are pinned to the codebase as of the survey. If a file has changed since, re-locate the line.
