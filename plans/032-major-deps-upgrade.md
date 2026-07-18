# Plan 032 — Major-version dependency upgrade

**Generated:** 2026-07-18
**Status:** Phases 1–5 complete (merged 2026-07-18 in `b2bdaec`). Phases 6–7 added post-completion (2026-07-18) — UX completeness + type-safety follow-ups, to be implemented in fresh sessions.
**Original target stack:** Next 16, React 19, TypeScript 7, MUI 9 (+ x-charts 8, x-date-pickers 8), ESLint 10, Jest 30, date-fns 4, mssql 12, next-auth 5
**Reworked target stack (latest-1):** Next 15, React 18.3 (no upgrade), TypeScript 6, MUI 7 (+ x-charts 7, x-date-pickers 7 — already at 7), ESLint 9, Jest 29 (no upgrade), date-fns 3, mssql 11 (no upgrade), next-auth 4 (no upgrade), @types/node 24
**Final stack (post Phases 1–5):** Next 15.5, React 18.3, TypeScript 6, MUI 7.3 (+ x-charts 7, x-date-pickers 7), ESLint 9.39 (flat config), Jest 29, date-fns 3, mssql 11, next-auth 4.24, @types/node 24, Node 22-alpine
**Current stack:** same as Final stack (Phases 6–7 are pending; not yet executed)

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
                          ├─> Phase 6 (Per-route loading.tsx / error.tsx + root not-found.tsx / global-error.tsx)
                          └─> Phase 7 (Enable noUncheckedIndexedAccess + sweep recordset[0] sites)

Phases 6 and 7 are independent of each other and of the upgrade work above; they were added post-completion as follow-ups. They can land in either order. Each gets its own branch + worktree (per CLAUDE.md `improve` workflow) since each runs in a fresh session.
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

## Phase 6 — Per-route `loading.tsx` / `error.tsx` + root `not-found.tsx` / `global-error.tsx`

**Why now:** The Next 15 App Router gives every route four free UX upgrades if the right files are present in the directory: a `loading.tsx` shows during data fetches, an `error.tsx` catches uncaught server-component errors, a root `not-found.tsx` renders on unknown URLs, and a root `global-error.tsx` is the last-resort catch. Without them, errors are silent and navigations are blank. The dep upgrade is done; the App Router is the runtime. Adding the files now is the smallest-possible UX win and is decoupled from any future work.

**Scope:** 4 root-level files + 8 page directories × 2 files each = 20 new files, plus 2 shared helper components (`RouteLoading`, `RouteError`) to keep the per-route files one-liners. No new dependencies. No changes to existing code.

**Steps**

1. **Pre-flight.** Confirm the current `main`/`upgrade` is green. In a fresh session, start from the most-recent commit on the working branch (the `b2bdaec` merge, or `HEAD` if subsequent work has landed):
   ```bash
   git fetch
   git checkout <branch>
   git pull
   npm install
   npm run build
   npm run test:all
   npm run lint
   ```
   If any fail, fix them first.

2. **Worktree per CLAUDE.md `improve` workflow.** Fresh session → fresh worktree:
   ```bash
   git branch improve/032-loading-error HEAD
   git worktree add ../Chicken-loading-error improve/032-loading-error
   Copy-Item "$(git rev-parse --show-toplevel)\.env" "$(Resolve-Path '..\Chicken-loading-error')\.env"
   ```
   All Phase 6 work happens in that worktree. Do **not** delete it after review.

3. **Shared helpers** (2 files):
   - `src/components/RouteLoading.tsx` — server component. Renders a centered MUI `CircularProgress` with top padding. No `"use client"` directive (server components are fine for static spinners).
   - `src/components/RouteError.tsx` — client component (`"use client"`). Takes `error: Error & { digest?: string }` and `reset: () => void` as props. Renders a MUI `Alert severity="error"` with the error message (production: a generic "Something went wrong" with the digest shown if present; dev: the actual error message) and a "Try again" Button that calls `reset()`.

4. **Root-level files** (4 files in `src/app/`):
   - `src/app/not-found.tsx` — server component. Centered MUI `Container` with a `Typography h4` ("Page not found") and a `Button` (`component={Link} href="/"`) that says "Go home". No `"use client"`.
   - `src/app/global-error.tsx` — root error boundary. **Must** include its own `<html><body>` because it replaces the root layout on the last-resort error path. `"use client"`. Renders the same content as the per-route `error.tsx` but without the layout chrome.
   - `src/app/loading.tsx` — root loading fallback. Re-exports `RouteLoading`. This is what shows during a cold start of any route the App Router has not yet rendered.
   - `src/app/error.tsx` — root error boundary. `"use client"`. Re-exports `RouteError` (receives the same `error` and `reset` props from Next).

5. **Per-route `loading.tsx` (8 files).** One for each page directory. Each is a one-liner that re-exports the shared helper:
   - `src/app/admin/loading.tsx`
   - `src/app/dashboard/loading.tsx`
   - `src/app/dashboard/eggs/loading.tsx`
   - `src/app/egg-history/loading.tsx`
   - `src/app/log-egg/loading.tsx`
   - `src/app/roster/loading.tsx`
   - `src/app/roster/enrol/loading.tsx`
   - `src/app/chickens/[id]/loading.tsx`
   
   Body of each: `export { default } from "@/components/RouteLoading";`

6. **Per-route `error.tsx` (8 files).** One for each page directory. Same 8 paths as step 5, with `error.tsx` instead of `loading.tsx`. Each is a `"use client"` component that re-exports the shared helper:
   ```tsx
   "use client";
   import RouteError from "@/components/RouteError";
   export default RouteError;
   ```

7. **Verify the route map.** After adding the files, the build output should still show the same 12 page routes (`○ /admin`, `○ /dashboard`, etc.) — the new files are UX boundaries, not new routes. A root-level `not-found` and `global-error` marker will appear if Next enumerates them. If a route disappears from the output, check that the new file is well-formed:
   ```bash
   npm run build 2>&1 | Select-String " /"
   ```

8. **Run the full verification:**
   ```bash
   npm run build
   npm run test:all
   npm run lint
   ```
   Component tests that use `renderWithProviders` (`tests/components/test-utils.tsx`) do **not** exercise these new files (they render specific page components, not the App Router), so no test updates are required.

9. **Manual smoke test (optional but recommended).** Start `npm run dev` and confirm:
   - `http://localhost:3000/admin` (and the other 7 routes) still render the same UI they did before.
   - `http://localhost:3000/this-does-not-exist` renders the new 404 page.
   - To exercise `error.tsx` without a real bug, temporarily add `throw new Error("test")` at the top of any `page.tsx`, navigate to it, see the error UI, then revert.

**Commit message:** `feat(ux): add loading.tsx, error.tsx, and not-found.tsx for all routes`

**STOP condition:** `npm run build`, `npm run test:all`, and `npm run lint` all green. The 8 page directories each have a `loading.tsx` and `error.tsx`; the app root has `not-found.tsx`, `global-error.tsx`, `loading.tsx`, and `error.tsx`. The smoke test confirms the 404 UI renders at an unknown URL. The `improve/032-loading-error` branch is ready for review and merge.

---

## Phase 7 — Enable `noUncheckedIndexedAccess` + sweep `recordset[0]` sites

**Why now:** With the dep upgrade complete, the codebase compiles clean under TS 6 strict. The remaining 35-40 `recordset[0]` access sites (verified per `.scratch/032-upgrade-deps/phase-results.md:196` — TS 6 does not enable `noUncheckedIndexedAccess` by default, so the project is not currently protected) are an unchecked class of bug: every site implicitly assumes the array has a row at index 0. For `INSERT OUTPUT` rows this is true by SQL contract, but for `SELECT` queries that may return zero rows, the runtime throws "Cannot read property 'foo' of undefined" — the very class of bug type-safety is meant to prevent.

**Scope:** 1 config change (`tsconfig.json`) + ~35-40 type-narrowing edits across 8 lib files (`src/lib/{analytics,chickens,db,dynamic-lists,eggs,notes,photos,users}.ts`). No new dependencies. No changes to API routes, no changes to test fixtures, no runtime behaviour change.

**Steps**

1. **Pre-flight.** Confirm the current `main`/`upgrade` is green:
   ```bash
   git fetch
   git checkout <branch>
   git pull
   npm install
   npm run build
   npm run test:all
   npm run lint
   ```
   If any fail, fix them first.

2. **Worktree per CLAUDE.md `improve` workflow.** Fresh session → fresh worktree:
   ```bash
   git branch improve/032-no-unchecked-indexed-access HEAD
   git worktree add ../Chicken-no-unchecked-indexed-access improve/032-no-unchecked-indexed-access
   Copy-Item "$(git rev-parse --show-toplevel)\.env" "$(Resolve-Path '..\Chicken-no-unchecked-indexed-access')\.env"
   ```
   All Phase 7 work happens in that worktree. Do **not** delete it after review.

3. **Enable the flag in `tsconfig.json`.** Add `"noUncheckedIndexedAccess": true` to `compilerOptions` (after `"strict": true` at `tsconfig.json:7`, before `"noEmit": true` at `tsconfig.json:9`). The current `tsconfig.json:1-26` does not have it.

4. **Run the build to surface errors:**
   ```bash
   npm run build 2>&1 | Tee-Object .scratch/032-upgrade-deps/no-unchecked-indexed-access-errors.log
   ```
   Expect ~35-40 errors, all in `src/lib/*.ts`. Sites that are *not* `recordset[0]` access (e.g. `args[0]`, `row.idx`, an array literal in a test) may also surface — handle them too but they're rare.

5. **Sweep the lib files in priority order.** The `recordset[0]` sites fall into 4 patterns; each has a different fix. Use `git grep -nE "recordset\[0\]" src/lib/` to enumerate the exact sites at execution time (the line numbers in this plan are pinned to the post-Phase-2 codebase; if anything has moved, follow the grep).

   **Pattern A: `INSERT OUTPUT` results** (safe — SQL guarantees a row). Files affected: `src/lib/chickens.ts:89`, `src/lib/eggs.ts:94, 154`, `src/lib/notes.ts:52`, `src/lib/photos.ts:46`. Fix: add `!` (the safe-bang):
   ```ts
   // before
   const id = result.recordset[0].id;
   // after
   const id = result.recordset[0]!.id;
   ```

   **Pattern B: `getBy*` functions** that cast `recordset[0] as T` and return it. Files affected: `src/lib/chickens.ts:113`, `src/lib/eggs.ts:159, 214, 290`, `src/lib/notes.ts:74`, `src/lib/photos.ts:67`, `src/lib/users.ts:20`. Fix: add a runtime guard before the cast:
   ```ts
   // before
   return (result.recordset[0] as Chicken) || null;
   // after
   const row = result.recordset[0] as Chicken | undefined;
   return row ?? null;
   ```
   The semantic is unchanged (the function already returned `null` when the row was missing); the type now matches.

   **Pattern C: `if (existing.recordset.length > 0) { ... existing.recordset[0] ... }`** — the length check doesn't narrow the indexed-access type. Files affected: `src/lib/dynamic-lists.ts:49, 69, 98`, `src/lib/eggs.ts:67, 127`, `src/lib/db.ts:242` (the `cnt` counter via `recordset[0].cnt`). Fix: destructure the checked row, or use the `!` on the inner use:
   ```ts
   // before
   if (existing.recordset.length > 0) return existing.recordset[0].id;
   // after
   if (existing.recordset.length > 0) return existing.recordset[0]!.id;
   ```
   The destructure alternative is sometimes cleaner:
   ```ts
   const [row] = existing.recordset;
   if (row) return row.id;
   ```

   **Pattern D: aggregate counts** — `src/lib/db.ts:242` (`countResult.recordset[0].cnt`), `src/lib/eggs.ts:511` (`countResult.recordset[0].total`). The SQL is `SELECT COUNT(*) AS cnt FROM ...`; the row is always present (COUNT of an empty set is 0, returned as one row). Add `!` and a comment:
   ```ts
   const count = countResult.recordset[0]!.cnt; // COUNT(*) always returns one row
   ```

   **Pattern E: `recordset.map(...)`** — these return arrays and are unaffected by `noUncheckedIndexedAccess`. No change needed. Sites: `src/lib/{analytics,chickens,dynamic-lists,eggs,notes,photos,users}.ts:*.map(...)`.

6. **Run again to confirm zero new errors:**
   ```bash
   npm run build
   ```

7. **Run the test suite to confirm no runtime regressions.** The integration tests in `tests/integration/` exercise the data layer; tightening the types should not change runtime behaviour, but verify:
   ```bash
   npm run test:all
   ```

8. **Run lint:**
   ```bash
   npm run lint
   ```

9. **Verify the flag is on.** Open `tsconfig.json` and confirm `"noUncheckedIndexedAccess": true` is present. (The build itself is the proof — if the flag were off, the build would not have caught the 35-40 sites in step 4. But the file check is the durable record.)

**Commit message:** `chore(types): enable noUncheckedIndexedAccess and narrow recordset[0] sites`

**STOP condition:** `npm run build` shows 0 errors. `npm run test:all` is green. `npm run lint` is green. `tsconfig.json` has `"noUncheckedIndexedAccess": true`. The 35-40 sites across 8 lib files are narrowed with one of the four patterns above (A, B, C, or D). The `improve/032-no-unchecked-indexed-access` branch is ready for review and merge.

---

## Risks that may require a follow-up plan

The following are **not** in the plan above because they're either speculative or out-of-scope for a dependency upgrade. Flag them in the PR if they materialize during execution:

1. **MUI 7 deprecates `Grid2 as Grid` in favour of plain `Grid`** — handled in Phase 3 step 2. The 7 `<Grid size={{ xs, sm }}>` call sites work as-is. If a later MUI 7 patch changes the `size` prop syntax, those 7 sites need an update. Quick fix.
2. **Next 15's default caching interacts badly with the existing API routes.** The 7 dynamic GET handlers depend on the DB (`/api/eggs`, `/api/chickens`, `/api/analytics`, `/api/dynamic-lists/*`, etc.) and must opt out of caching with `export const dynamic = "force-dynamic";` (Phase 1 step 8). If any are missed, stale-data symptoms will appear at runtime, not at build time.
3. **`react-easy-crop@6` may break under MUI 7's Emotion 11 version bump** (MUI 7 still uses Emotion 11, so this is unlikely — but worth a smoke test on `/chickens/[id]` after Phase 3 lands). The CropDialog at `src/components/CropDialog.tsx:1-120` is the only consumer.
4. **The `migrationsPromise` top-level call at `src/lib/db.ts:269-271` may be flagged by Next 15's server runtime** as a disallowed top-level await. If so, refactor to a `beforeRequest`-style pattern or move to `middleware.ts`. Out of scope here.

---

## What this plan does NOT do

To keep scope focused, the plan deliberately excludes:

- **Adding `src/middleware.ts` for edge-auth.** The project does per-route `getServerSession` checks today; introducing middleware is a refactor, not an upgrade. Pairs naturally with the next-auth 4 → 5 jump (still beta as of 2026-07; defer until stable).
- **Upgrading to Next 16 / React 19 / TypeScript 7 / ESLint 10 / MUI 9** (the absolute-latest stack this plan originally targeted). Deferred because the plugin ecosystem is not caught up — see the rework note in the header. Re-evaluate in 2026-Q4 / 2027-Q1.
- **Switching from CJS to ESM at the package level** (`"type": "module"`). Not needed for any of the reworked targets.
- **Migrating the `palette.ts` MD3 system to MUI 7's built-in tokens.** MUI 7 has no built-in MD3 system (that's MUI Joy UI's `extendTheme`, a separate package). The current `palette.ts:1-131` (which uses `@material/material-color-utilities` to generate MD3 colours and `theme.ts:1-169` to map them into MUI 7's palette shape) is the right architecture. The broader MD3 work is in flight at `.scratch/mui-md3-migration/` (11 tickets, `ready-for-agent`).

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
