# Plan 032 — Major-version dependency upgrade

**Generated:** 2026-07-18
**Status:** PROPOSED (awaiting user approval before any execution)
**Target stack:** Next 16, React 19, TypeScript 7, MUI 9 (+ x-charts 8, x-date-pickers 8), ESLint 10, Jest 30, date-fns 4, mssql 12, next-auth 5
**Current stack:** Next 14.2, React 18.3, TypeScript 5.6, MUI 6.5 (+ x-charts 7, x-date-pickers 7), ESLint 8.57, Jest 29, date-fns 2.30, mssql 11, next-auth 4.24

> **Read this first.** This plan is the result of `npx npm-check-updates` + a full codebase survey. The survey findings live in the planning notes — every "Ref" below is `file:line`. The plan deliberately sequences work so each phase ends at a green build + green tests. Do not collapse phases into a single commit; the diff would be un-reviewable.
>
> **Reality check.** Next 16, React 19, TypeScript 7, ESLint 10, and MUI 9 are all very recent. Some of the version numbers quoted in this plan are best-available estimates — the executor must `npm view <pkg> version` at the start of each phase and adjust if a more recent stable has shipped. Where the plan says "X.Y", read it as "the most recent X.Y at execution time".

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

**0.3 Set a Node version target.** Next 16 requires Node ≥ 20.9. Pick one and stick to it: **Node 22 LTS** is the safe target for 2026. Update `package.json` with:

```json
"engines": { "node": ">=20.9.0" }
```

(Update the Dockerfile to `FROM node:22-alpine` in the final phase — flagged in §9.)

**0.4 Create a verification scratch file.** Track green-build evidence at the end of each phase:

```
.scratch/032-upgrade-deps/phase-results.md
```

After each phase, paste the final 10 lines of `npm run build` and the `Tests: X passed` line from `npm run test:all`.

---

## Phase dependency graph

```
Phase 1 (TS 7 + @types/node 26)
  └─> Phase 2 (React 19 + @types/react 19)
        └─> Phase 3 (Next 16 + ESLint 10 + eslint-config-next 16)
              ├─> Phase 4 (MUI 9 + x-charts 8 + x-date-pickers 8)
              │     └─> Phase 5 (date-fns 4 + picker adapter split)
              ├─> Phase 6 (mssql 12, drop @types/mssql)
              └─> Phase 7 (Jest 30)
                    └─> Phase 8 (next-auth v5)
                          └─> Phase 9 (Dockerfile, compose, .env, .dockerignore, docs)
```

Phases 4, 6, and 7 are independent after Phase 3 and could in principle be done in parallel branches — but the worktree model means a single sequential path is simpler to review.

---

## Phase 1 — TypeScript 5 → 7 + `@types/node` 20 → 26

**Why first:** Touches only `package.json`, `tsconfig.json`, and the types of Node globals. If the build still compiles, every later phase inherits a clean TS 7 baseline.

**Steps**

1. `npm install --save-dev typescript@^7.0.2 @types/node@^26.1.1`
2. Edit `tsconfig.json`:
   - `target`: bump `es2017` → `es2022` (TS 7's recommended baseline; required for `Array.prototype.at`, `Object.hasOwn`).
   - Keep `module: "esnext"`, `moduleResolution: "bundler"`, `strict: true`, `isolatedModules: true`.
   - Do **not** add `noUncheckedIndexedAccess` yet — that's a separate quality improvement and would expand scope. If TS 7 enables it by default, the §1.3 section below covers how to opt out.
3. **If TS 7 enables stricter checks by default**, the ~47 `result.recordset[0]` accesses in the 8 mssql lib files will start producing `T | undefined` errors. **Temporary mitigation** for this phase only: add `"noUncheckedIndexedAccess": false` to `tsconfig.json`'s `compilerOptions`. Phase 6 will revisit whether to keep the opt-out or fix the accesses properly.
4. `next-env.d.ts` (Ref: `next-env.d.ts:1-5`) imports `./.next/types/routes.d.ts`. If Next 16 in Phase 3 renames the generated file, that import breaks — Phase 3 handles it. For now, the file is fine.
5. Run:
   ```bash
   npm run build
   npm run test:all
   ```
6. **Expected outcome:** A handful of new type errors may surface (TS 7 is stricter than 5.6). Fix them in this phase — they will compound if deferred. Common sites to expect:
   - `src/lib/auth.ts:40` — `(session.user as Record<string, unknown>).role = token.role` may now warn about an unsafe cast through `Record<string, unknown>`. Refactor to a typed local var.
   - `src/lib/chickens.ts:95, 104, 113`, `src/lib/eggs.ts:160, 205, 214`, `src/lib/photos.ts:47, 58, 67, 86`, `src/lib/notes.ts:53, 65, 74, 99`, `src/lib/users.ts:20, 28` — `as Chicken`, `as Photo[]`, etc. TS 7 may reject double-`as` chains; narrow with a runtime check or `as unknown as T`.
   - `src/lib/analytics.ts:128, 157, 185, 214, 243, 275, 307, 355, 394, 423, 461, 498, 511` — `recordset[0]` access. If TS 7 keeps `noUncheckedIndexedAccess` off by default, no change. If on, see §1.3.

**Commit message:** `chore(deps): upgrade typescript 5 → 7 and @types/node 20 → 26`

**STOP condition:** `npm run build` and `npm run test:all` both green. `.scratch/032-upgrade-deps/phase-results.md` updated.

---

## Phase 2 — React 18 → 19 + `@types/react` 18 → 19

**Why before Next:** React 19 has peer requirements on Next 15+; the install must happen in this order to avoid transient peer-dep conflicts.

**Steps**

1. `npm install react@^19.2.7 react-dom@^19.2.7`
2. `npm install --save-dev @types/react@^19.2.17 @types/react-dom@^19.2.3`
3. **Survey-confirmed:** The codebase has **zero** uses of `forwardRef`, `useFormState`, `propTypes`, string refs, legacy context, or `defaultProps` on function components. The only `useRef` is the safe `useRef<HTMLInputElement>(null)` at `src/components/ThemeToggle.tsx:29,109`. So this phase is mostly a version bump.
4. **Watch for `useEffect` StrictMode double-invoke issues**:
   - `src/app/page.tsx:108-110` — `router.replace(...)` inside `useEffect`. React 19's stricter StrictMode will invoke this twice in dev. Verify no infinite redirect loop; if there is, add a `useRef` guard or move the logic to a one-shot `useEffect` with a stable guard.
   - `src/app/dashboard/page.tsx:9-11` — same pattern, same check.
   - `src/theme/ThemeModeProvider.tsx:30-39, 41-51` — localStorage + matchMedia effects. The localStorage read may run twice; ensure the state setter is idempotent (it is — `setMode(...)` with the same value is a no-op for React).
5. Run `npm run build && npm run test:all`.
6. **Expected outcome:** Build green, all 102 tests still pass. The component tests use `@testing-library/react@^16.0.1` (already React-19-compatible). The `jest.mock("next-auth/react", ...)` hoisting at `tests/components/setup.ts:4-8` works under React 19 + Jest 29.

**Commit message:** `chore(deps): upgrade react 18 → 19 and @types/react 18 → 19`

**STOP condition:** Same as Phase 1. No test changes expected.

---

## Phase 3 — Next.js 14 → 16 + ESLint 8 → 10 + `eslint-config-next` 14 → 16

**Why this is the central phase:** Touches the build pipeline, the lint setup, the config file, and unlocks the rest. Nothing else compiles until this lands.

**Steps**

1. `npm install next@^16.2.10`
2. `npm install --save-dev eslint@^10.7.0 eslint-config-next@^16.2.10`
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
   import nextPlugin from "@next/eslint-plugin-next";
   export default [
     {
       plugins: { "@next/next": nextPlugin },
       rules: {
         ...nextPlugin.configs.recommended.rules,
         ...nextPlugin.configs["core-web-vitals"].rules,
       },
     },
   ];
   ```
   (If `eslint-config-next@16` ships a flat-config preset, prefer that — check the package's README at execution time. The form above is the lowest-common-denominator fallback.)
5. **Update `next.config.js`** (Ref: `next.config.js:1-6`):
   - Add `serverExternalPackages: ["mssql", "sharp", "tedious"]` — needed because `mssql` depends on native `tedious` and `sharp` is ESM-only with platform-specific binaries. Without this, Next 16's bundler will choke on them.
   - Consider renaming `next.config.js` → `next.config.mjs` (or `.ts`) to use ESM. If you do, update the Dockerfile `COPY` line that lists it.
   - Verify `output: "standalone"` still works (the Dockerfile depends on it at `Dockerfile:23`).
6. **Async-by-default route params.** Next 15 made `params` async in route handlers. The project has 4 dynamic route handlers — verify they accept `await`:
   - `src/app/api/chickens/[id]/route.ts` — uses `params.id`
   - `src/app/api/chickens/[id]/notes/[noteId]/route.ts`
   - `src/app/api/chickens/[id]/photos/[photoId]/route.ts`
   - `src/app/api/chickens/[id]/photos/[photoId]/primary/route.ts`
   - `src/app/api/dynamic-lists/[type]/route.ts` — uses `params.type`
   - `src/app/api/dynamic-lists/[type]/merge/route.ts`
   - `src/app/api/photos/[filename]/route.ts` — uses `params.filename`
   
   Each handler signature must change from `(req, { params }: { params: { id: string } })` to `(req, { params }: Promise<{ id: string }>)` and then `const { id } = await params;`. **Touch all 7 of these files.** Use a grep for `params\.[a-z]+` in `src/app/api/` to confirm none are missed.
7. **Async `cookies()` and `headers()`.** Next 15+ made these async. The `getServerSession` call sites in 14 API routes already pull these (Ref: 14 files / 25+ sites in the survey). Since Phase 8 will replace `getServerSession` with `await auth()`, this is automatically handled. **But** if any of the 14 routes call `cookies()` or `headers()` directly outside of `getServerSession`, those need to be `await`ed too. **Verify** with:
   ```bash
   grep -rn "cookies()\|headers()" src/app/
   ```
   If any are unawaited, fix them in this phase.
8. **Stricter caching defaults.** Next 16 caches GET route handlers by default. The project has GET handlers that depend on the DB (`/api/eggs`, `/api/chickens`, `/api/analytics`, `/api/dynamic-lists/*`). Add `export const dynamic = "force-dynamic";` to each, OR add `export const revalidate = 0;` — verify which is the correct Next 16 idiom at execution time. The simpler default of `dynamic = "force-dynamic"` is fine for a LAN app where you always want fresh data.
9. Run `npm run build && npm run test:all && npm run lint`.
10. **Expected outcome:** Build green, all tests pass, lint runs (may surface new warnings from the upgraded ESLint — fix them as part of this phase, don't defer).

**Commit message:** `chore(deps): upgrade next 14 → 16, eslint 8 → 10 (flat config)`

**STOP condition:** Same. Lint must be green.

---

## Phase 4 — MUI 6 → 9 + `@mui/x-charts` 7 → 8 + `@mui/x-date-pickers` 7 → 8

**Why after Next 16:** MUI 9 requires Next 15+, and the `@mui/material-nextjs` cache provider added in this phase must be wired into the Next 16 provider tree. Doing MUI before Next would force you to re-wire the providers twice.

**Steps**

1. `npm install @mui/material@^9.2.0 @mui/icons-material@^9.2.0 @mui/x-charts@^9.10.0 @mui/x-date-pickers@^9.10.0 @mui/material-nextjs@latest`
   (The exact `@mui/material-nextjs` version tracks Next; `latest` will pick the right one.)
2. **`Grid2 as Grid` rename — 3 files:**
   - `src/app/page.tsx:18` — change `import { ..., Grid2 as Grid, ... }` → `import { ..., Grid, ... }`
   - `src/app/log-egg/page.tsx:21` — same
   - `src/app/chickens/[id]/page.tsx:38` — same
   
   The `<Grid size={{ xs, sm }}>` prop syntax is unchanged across the rename. The 7 call sites listed in the survey (page.tsx:283, 294; log-egg/page.tsx:412-414; chickens/[id]/page.tsx:1093, 1094, 1100, 1106, 1112) work as-is.
3. **Deprecated prop migrations — 8 files:**
   - `src/components/AppShell.tsx:111` — `ModalProps={{ keepMounted: true }}` → `slotProps={{ root: { keepMounted: true } }}`
   - `src/components/ChickenTableRow.tsx:186` — `InputLabelProps={{ shrink: true }}` → `slotProps={{ inputLabel: { shrink: true } }}`
   - `src/components/HenRow.tsx:73` — `inputProps={...}` → `slotProps={{ htmlInput: ... }}`
   - `src/app/egg-history/page.tsx:256, 267` — same `inputProps` → `slotProps.htmlInput`
   - `src/app/log-egg/page.tsx:529, 540` — same
   - `src/components/UserMenu.tsx:55` — `MenuListProps={{ "aria-label": ... }}` → `slotProps={{ list: { "aria-label": ... } }}`
   - `src/components/ThemeToggle.tsx:75` — same `MenuListProps` → `slotProps.list`
   - `src/app/chickens/[id]/page.tsx:1402` — `ListItem.secondaryAction={...}` → wrap the action in `<ListItem secondaryAction={<...>}>`. MUI v7 may accept `slotProps={{ secondaryAction: ... }}`; check docs.
4. **ImageList deprecation** (MUI v7 deprecates, may remove later): `src/app/chickens/[id]/page.tsx:33-34, 1148, 1152, 1244, 1247`. If MUI 9 still has `ImageList`, no change. If renamed/removed, follow the codemod:
   ```bash
   npx @mui/codemod v7.0.0 /src/app/chickens
   ```
   Run the codemod **before** manual edits — it handles most v6→v7 prop migrations automatically.
5. **x-charts `onItemClick` deprecation** (Ref: `src/app/page.tsx:363, 513`): The v8 codemod replaces `onItemClick` with `onAxisClick` (BarChart) and `onMarkClick` (PieChart). The signature changes too. Run the codemod:
   ```bash
   npx @mui/x-codemod v8.0.0/charts src/app/page.tsx
   ```
   Then re-read `page.tsx:350-365` and `503-529` to confirm the new handler signatures are wired correctly. The chart data shape (e.g. `e.dataIndex`) may have moved into the new event object's nested property.
6. **Add `AppRouterCacheProvider`** to `src/app/providers.tsx` (Ref: `src/app/providers.tsx:1-34`):
   ```tsx
   "use client";
   import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";  // or v15-appRouter if v16 not shipped
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
   `AppRouterCacheProvider` is the **outermost** wrapper. This is required for MUI/Emotion SSR styles to flush correctly under Next 16.
7. **The `src/app/auth/error/page.tsx` and `src/app/unauthorized/page.tsx` server-vs-client warning.** Both are server components but import `@mui/icons-material/ArrowBackIcon`. Under Next 16 with React 19, importing a client component into a server component requires an explicit `"use client"` boundary or a wrapper. Either:
   - Add `"use client";` to both files (simplest), OR
   - Create a thin `BackButton` client component that wraps `Button + ArrowBackIcon` and import that.
   
   Recommend the wrapper — it keeps the pages as server components. Place at `src/components/BackButton.tsx`.
8. Run `npm run build && npm run test:all && npm run lint`.
9. **Expected outcome:** Build green, tests pass. Component tests that render MUI components (AppShell, NavMenu, UserMenu, HealthIndicator, RosterPage) all use the render utilities at `tests/components/test-utils.tsx:1-30` — verify the `renderWithProviders` helper still wraps everything correctly with the new `AppRouterCacheProvider` added.

**Commit message:** `chore(deps): upgrade @mui/material 6 → 9, @mui/x-charts 7 → 8, @mui/x-date-pickers 7 → 8`

**STOP condition:** Same. Component tests must be green (5 suites per the README).

---

## Phase 5 — `date-fns` 2 → 4 + `@mui/x-date-pickers` adapter split

**Why after MUI:** The adapter change is contingent on the picker version being at v8+.

**Steps**

1. `npm install date-fns@^4.4.0`
2. **Verify the locale imports** in `src/lib/dateUtils.ts:1-58` against the date-fns v4 locale list. The list currently imports: `enUS, enGB, enAU, enCA, enNZ, enZA, enIE, enIN, de, deAT, fr, frCA, frCH, es, it, itCH, pt, ptBR, nl, nlBE, sv, nb, nn, da, fi, pl, ru, uk, ja, zhCN, zhTW, zhHK, ko, ar, arSA, arEG, hi, tr, vi, th, id, ms, he, el, hu, cs, sk, ro, bg, hr, sr, srLatn, sl, lt, lv, et`.
   
   date-fns v3+ renamed some locales — the most likely breakage is one of the Cyrillic or right-to-left locales. The date-fns v3 migration guide (https://git.io/fxCyr) is the authoritative reference. If a locale name changed, update the import.
3. **Replace the date-fns adapter** in `src/app/providers.tsx:8-9` and `tests/components/test-utils.tsx:4-5`:
   - Remove: `import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";`
   - Add: `import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";` (or `AdapterDateFnsV4` if the v8+ pickers have a v4-specific adapter; check the package's `AdapterDateFns*` exports).
4. The `Locale` type import at `src/lib/dateUtils.ts:59` — `import type { Locale } from "date-fns";` — is unchanged. The shape of `Locale` is stable across v2/v3/v4.
5. The `Intl.DateTimeFormat` usage at `src/lib/dateUtils.ts:168-193` is independent of date-fns and needs no change.
6. Run `npm run build && npm run test:all`.
7. **Expected outcome:** Build green, all 102 tests pass. Component tests that exercise `DatePicker` (via the rendered `page.tsx`, `log-egg/page.tsx`, `chickens/[id]/page.tsx`) will exercise the new adapter path — failures will be adapter-shape mismatches, not data mismatches.

**Commit message:** `chore(deps): upgrade date-fns 2 → 4 and switch x-date-pickers to v3+ adapter`

**STOP condition:** Same.

---

## Phase 6 — `mssql` 11 → 12, drop `@types/mssql`

**Why now:** The TS 7 baseline (Phase 1) is in place to absorb any new type errors from the v12 type changes.

**Steps**

1. `npm install mssql@^12.7.0`
2. `npm uninstall @types/mssql` — `mssql@12` ships its own types. Leaving `@types/mssql@9.1.4` in place will cause a duplicate-identifier error on `ConnectionPool`, `config`, and the type constants.
3. **Verify all 8 lib files still compile:**
   - `src/lib/db.ts:1-18` — the `sql.config` shape is unchanged in v12. The `pool.max/min/idleTimeoutMillis` shape is unchanged.
   - `src/lib/db.ts:22-27` — `new sql.ConnectionPool(config).connect()` — unchanged.
   - The 8 files: `src/lib/{db,chickens,eggs,analytics,users,photos,notes,dynamic-lists}.ts` — all use `import sql from "mssql"` (default import) plus `sql.NVarChar`, `sql.Date`, `sql.Int`, `sql.Decimal(5,2)`, `sql.Bit`, `sql.NVarChar(sql.MAX)`. All preserved in v12.
4. **Transaction API change** (Ref: `src/lib/eggs.ts:99-170`): v12 changed `transaction.begin()` to return a result. Verify:
   ```ts
   const transaction = new sql.Transaction(pool);
   await transaction.begin();
   try { ... } catch { await transaction.rollback(); throw; }
   ```
   still works. If v12 requires the result to be inspected, the executor will see a runtime error during integration tests, not a type error.
5. **The `migrationsPromise` / `migrationsRun` TDZ pattern** at `src/lib/db.ts:254-255` referenced from `closePool()` at `:41-43` — both top-level `let`s, hoisted via TDZ; works at runtime because `closePool` is only called after `ensureMigrations()` resolves. No change needed.
6. **Top-level `await ensureMigrations().catch(...)` at `src/lib/db.ts:269-271`** — Next 16 may be stricter about this. If a build error appears, move the call into a `beforeRequest` hook or into the route handler entry. Alternative: wrap with a `Promise<void>` field and only call from a `middleware.ts` (but the project has no middleware — adding it is out of scope for this upgrade).
7. **Re-evaluate the `noUncheckedIndexedAccess` opt-out from Phase 1.** With mssql 12's types landed, the `result.recordset[0]` accesses at ~47 sites in the 8 mssql files become `T | undefined` if TS 7's strict mode enables this. Recommended approach: keep the opt-out for now (technical debt, separately planned); do not let it block this phase.
8. Run `npm run build && npm run test:all && npm run test:integration` (integration tests require a live DB; if unavailable, run unit + component only).
9. **Expected outcome:** Build green, all tests pass. The integration test suite (if it can run) will exercise the mssql v12 connection pool — failures will be at the protocol level, not the API level.

**Commit message:** `chore(deps): upgrade mssql 11 → 12, drop redundant @types/mssql`

**STOP condition:** Same, plus `npm run test:integration` green (or explicitly noted as not-runnable in the env).

---

## Phase 7 — Jest 29 → 30

**Why after mssql:** Jest 30 is mostly orthogonal to the other upgrades. Doing it now means subsequent phases can rely on the new test runner.

**Steps**

1. `npm install --save-dev jest@^30.4.2 @types/jest@^30.0.0 ts-jest@^29.4.11`
   (Note: `ts-jest@29.x` is compatible with both Jest 29 and 30. Do not jump to `ts-jest@30` unless released at execution time.)
2. `jest-environment-jsdom@^30.4.1` is already in `package.json:50` (Ref: `package.json:50`). Confirm it stays at v30.
3. **Three Jest configs** (Ref: `jest.config.ts`, `jest.component.config.ts`, `jest.integration.config.ts`) — verify:
   - `preset: "ts-jest"` still works in Jest 30.
   - `testEnvironment: "node"` / `"jsdom"` still works.
   - `moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" }` still works.
4. **`transformIgnorePatterns`** at `jest.component.config.ts:19-21`:
   ```ts
   transformIgnorePatterns: ["node_modules/(?!@material/material-color-utilities)"]
   ```
   With MUI 9 fully ESM, you may need to expand the whitelist. Try first; if component tests fail with "Cannot use import statement outside a module", add to the pattern:
   ```ts
   transformIgnorePatterns: [
     "node_modules/(?!(@material/material-color-utilities|@mui/x-date-pickers|@mui/x-charts|@mui/material|@mui/system|@mui/utils|@mui/private-theming|@mui/styled-engine))"
   ]
   ```
   Adjust the list to whatever subset of MUI ships ESM and is imported by the components being tested.
5. **Test scripts in `package.json:10-13`** — `jest --runInBand` works in Jest 30; the `--config` flag is unchanged. No change needed.
6. The component test mocks at `tests/components/setup.ts:4-18` (`jest.mock("next-auth/react", ...)`, `jest.mock("next/navigation", ...)`) — verify the hoisting still works under Jest 30's module-resolution changes. The mocks use `jest.fn()` patterns, which are unchanged.
7. Run `npm run test:all`.
8. **Expected outcome:** All 102 tests pass. If a test fails with a transform error, expand `transformIgnorePatterns` (step 4) until it passes.

**Commit message:** `chore(deps): upgrade jest 29 → 30, @types/jest 29 → 30, ts-jest 29 → 29.4.11`

**STOP condition:** `npm run test:all` green.

---

## Phase 8 — `next-auth` v4 → v5 (Auth.js) — the largest single migration

**Why last among deps:** Touches 14 API routes, 11 client files, the catch-all route, the type augmentation, the auth config, the env-var naming, and the docker-compose. Doing it last means the rest of the stack is stable while the auth refactor lands.

**Steps**

1. `npm install next-auth@^5.0.0`
2. **Rewrite `src/lib/auth.ts`** (Ref: `src/lib/auth.ts:1-45`). The v4 `NextAuthOptions` shape becomes a v5 `NextAuthConfig`. The export pattern changes from a config object to a destructured set of helpers:
   ```ts
   import NextAuth from "next-auth";
   import Google from "next-auth/providers/google";
   import type { NextAuthConfig } from "next-auth";

   export const config: NextAuthConfig = {
     providers: [Google],
     session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
     pages: { signIn: "/", error: "/auth/error" },
     callbacks: {
       // jwt and session callback signatures are unchanged for the v5 stable line
       async signIn({ user }) { ... },
       async jwt({ token, user }) { ... },
       async session({ session, token }) {
         (session.user as { role?: string }).role = (token as { role?: string }).role ?? "Viewer";
         return session;
       },
     },
   };

   export const { handlers, auth, signIn, signOut } = NextAuth(config);
   ```
3. **Rewrite the catch-all route** at `src/app/api/auth/[...nextauth]/route.ts` (Ref: 6 lines) to:
   ```ts
   export { GET, POST } from "@/lib/auth";
   ```
   (or whichever export name v5 uses — verify at execution time; some v5 betas use `handlers`, others use named `GET`/`POST`).
4. **Update the type augmentation** at `src/types/next-auth.d.ts:1-22`:
   - `declare module "next-auth"` for `User` + `Session.user.role` — unchanged shape, just the module name.
   - `declare module "next-auth/jwt"` → `declare module "@auth/core/jwt"` for the `JWT` type augmentation.
5. **Replace `getServerSession(authOptions)` with `await auth()` in all 14 API route files** (Ref: full list in survey §1). The mechanical pattern:
   ```ts
   // Before
   import { getServerSession } from "next-auth";
   import { authOptions } from "@/lib/auth";
   const session = await getServerSession(authOptions);
   
   // After
   import { auth } from "@/lib/auth";
   const session = await auth();
   ```
   The `session.user.role` access pattern is unchanged (the module augmentation makes `role` a known property on `session.user`).
6. **Update the import of `SessionProvider`** at `src/app/providers.tsx:3`:
   ```ts
   import { SessionProvider } from "next-auth/react";  // unchanged
   ```
   `next-auth/react` is preserved in v5 — no change. Same for the 11 client-side `useSession` / `signIn` / `signOut` imports.
7. **The literal `/api/auth/signout` href** at `src/app/unauthorized/page.tsx:29` — still works in v5.
8. **Env var rename** — across three files:
   - `.env.example:16-17` — `NEXTAUTH_SECRET` → `AUTH_SECRET`, `NEXTAUTH_URL` → `AUTH_URL`
   - `docker-compose.yml.example:15-16` — same
   - `.env` (the actual env file, not in git) — same. (The executor must update their local `.env` too — Phase 9 cleans up the .dockerignore but not the .env file since it's untracked.)
9. **Test mocks** at `tests/components/setup.ts:4-8`:
   ```ts
   jest.mock("next-auth/react", () => ({
     useSession: jest.fn(() => ({ data: null, status: "unauthenticated" })),
     signIn: jest.fn(),
     signOut: jest.fn(),
     SessionProvider: ({ children }: { children: React.ReactNode }) => children,
   }));
   ```
   The mock surface for v5 is the same — `useSession`, `signIn`, `signOut`, `SessionProvider`. No change needed.
10. **Sign-in flow on the home page** at `src/app/page.tsx` (Ref: the splash-screen region) — uses `signIn` from `next-auth/react`. No change in v5.
11. Run `npm run build && npm run test:all && npm run lint`.
12. **Expected outcome:** Build green, all 102 tests pass. The 14 API routes now use the v5 `auth()` helper. Manual smoke test: `npm run dev`, navigate to `/`, sign in with Google, verify session and role propagation across `/admin`, `/roster`, `/chickens/[id]`.

**Commit message:** `chore(deps): upgrade next-auth 4 → 5 (Auth.js) — new auth helper, env var rename`

**STOP condition:** Same. Plus a manual sign-in smoke test noted in the phase-results file.

---

## Phase 9 — Cleanup: Dockerfile, compose, .dockerignore, docs

**Why last:** All the version-specific changes are landed; this phase updates the supporting infra and docs.

**Steps**

1. **Dockerfile** (Ref: `Dockerfile:1-28`):
   - `FROM node:20-alpine` → `FROM node:22-alpine` (matches the Node 22 LTS target set in Phase 0.3).
   - Add `COPY eslint.config.mjs ./` (Ref: `Dockerfile:14` — currently only copies `tsconfig.json next.config.js`).
   - If `next.config.js` was renamed to `.mjs`/`.ts` in Phase 3, update the `COPY` line.
   - No change to the `sharp` install — `npm ci` picks up the platform-specific binary.
2. **`docker-compose.yml.example`** (Ref: lines 15-16): confirm the `NEXTAUTH_*` → `AUTH_*` rename from Phase 8 is in.
3. **`.dockerignore`** (Ref: 6 lines): add `.scratch/`, `plans/`, `coverage/` to reduce build context.
4. **`package.json` `engines` field** (added in Phase 0.3): verify the entry is present.
5. **Update `package.json` `description` / README** (if any) with the new version matrix. The repo's `README.md` (if it has a "Stack" section) should reflect Next 16 / React 19 / MUI 9. The `CLAUDE.md` / `CONTEXT.md` should not need version-specific changes — they describe patterns, not versions.
6. **Verify `.scratch/032-upgrade-deps/phase-results.md`** has a green-build line from every phase.
7. Run the full verification one more time:
   ```bash
   npm install
   npm run build
   npm run test:all
   npm run lint
   ```

**Commit message:** `chore(infra): update Dockerfile to Node 22, refresh .dockerignore, add eslint.config.mjs to build context`

**STOP condition:** All four commands green. The `improve/032-major-deps` branch is ready for review.

---

## Risks that may require a Phase 10

The following are **not** in the plan above because they're either speculative or out-of-scope for a dependency upgrade. Flag them in the PR if they materialize during execution:

1. **TypeScript 7 enables `noUncheckedIndexedAccess` by default** in `strict` mode. If Phase 1's opt-out doesn't work, ~47 `result.recordset[0]` sites in the 8 mssql lib files will need non-null assertions or guard-clause refactors. Estimated effort: 2-4 hours. Best done as a follow-up plan.
2. **MUI 9 breaks the custom MD3 palette in `src/theme/palette.ts`** (Ref: `src/theme/palette.ts:1-5`). The `@material/material-color-utilities` package is not a MUI package, but if MUI 9 ships a competing token system, the project may want to migrate. Out of scope here.
3. **MUI 9 deprecates `Grid` again or changes the `size` prop syntax.** The 7 call sites in Phase 4 assume the current `size={{ xs, sm }}` shape is preserved. If it changes, the call sites need an update. Quick fix — read the MUI 9 migration guide at execution time.
4. **Next 16's stricter caching interacts badly with `getServerSession` → `auth()` migration** in Phase 8. If API routes start returning stale data, add `export const dynamic = "force-dynamic";` to each (mentioned in Phase 3 step 8 — may need to extend to all 14 routes if Phase 8 surfaces it).
5. **`react-easy-crop@6` is unmaintained or breaks under React 19.** The CropDialog at `src/components/CropDialog.tsx:1-120` is the only consumer. If it breaks, consider swapping to `react-image-crop` (no React 19 support either) or a maintained alternative. Out of scope.
6. **The `migrationsPromise` top-level call at `src/lib/db.ts:269-271` may be flagged by Next 16's server runtime** as a disallowed top-level await. If so, refactor to a `beforeRequest`-style pattern or move to `middleware.ts`. Out of scope here.

---

## What this plan does NOT do

To keep scope focused, the plan deliberately excludes:

- **Adding `loading.tsx` / `error.tsx` / `not-found.tsx`** to the 8 page directories that lack them. The survey flagged their absence; a separate plan can address it.
- **Enabling `noUncheckedIndexedAccess`** as a quality improvement. The Phase 1 opt-out keeps the upgrade on rails; adopting `noUncheckedIndexedAccess` is its own piece of work.
- **Adding `src/middleware.ts` for edge-auth.** The project does per-route `getServerSession`/`auth()` checks today; introducing middleware is a refactor, not an upgrade.
- **Switching from CJS to ESM at the package level** (`"type": "module"`). Required for some date-fns 4 / mssql 12 paths but Next 16 + TypeScript 7 + Jest 30 should handle the mixed CJS/ESM world without the package-level switch. If not, this is a Phase 10.
- **Migrating the `palette.ts` MD3 system to MUI 9's built-in tokens.** Major refactor; out of scope.

---

## Verification matrix

Per `CLAUDE.md`'s `improve` workflow, every phase must close with these commands green:

| Command | Purpose |
|---|---|
| `npm run build` | Next 16 build pipeline, route generation, type-check |
| `npm run test` | Jest 30 unit/integration (7 suites, node env) |
| `npm run test:components` | Jest 30 component tests (5 suites, jsdom) |
| `npm run test:all` | Both of the above |
| `npm run lint` | ESLint 10 flat config |
| `npm run test:integration` | Optional — only if a live SQL Server is available in the executor's env |

---

## Reference

- This plan was produced from `npx npm-check-updates` output captured 2026-07-18 and a full codebase survey (also 2026-07-18). Survey notes: see `.scratch/032-upgrade-deps/survey.md` if generated; otherwise, re-run the survey agent if the codebase has changed since.
- All file:line references in this plan are pinned to the codebase as of the survey. If a file has changed since, re-locate the line.
