# Plan 002: Add auth guards to unauthenticated GET endpoints

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5761d68..HEAD -- src/app/api/chickens/route.ts src/app/api/dynamic-lists/*/route.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security / correctness
- **Planned at**: commit `5761d68`, 2026-07-01

## Why this matters

Two GET endpoints (`/api/chickens` and `/api/dynamic-lists/:type`) return data without requiring authentication. Every other endpoint in the app checks `getServerSession(authOptions)` and returns 401 if no session. These two are inconsistent with the documented auth model (ADR 0003 — all data access requires allowlist authorization). Adding the guard aligns them with the rest of the API and prevents data leakage to unauthenticated callers.

## Current state

**`src/app/api/chickens/route.ts`** — `GET` handler (lines 7-22) has no auth check, while the `POST` handler (line 26) does:
```typescript
export async function GET(request: NextRequest) {
  try {
    await runMigrations();
    const { searchParams } = new URL(request.url);
    const includeDeparted = searchParams.get("includeDeparted") === "true";
    const chickens = await listChickens(includeDeparted);
    return NextResponse.json(chickens);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

**`src/app/api/dynamic-lists/[type]/route.ts`** — `GET` handler (lines 29-47) has no auth check, while `POST`, `PUT`, and `DELETE` all call `requireAdmin()`:
```typescript
export async function GET(
  _request: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    const listType = normalizeType(params.type);
    if (!listType) {
      return NextResponse.json({ message: "Invalid list type" }, { status: 400 });
    }
    await runMigrations();
    const values = await listValues(listType);
    return NextResponse.json(values);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

**Repo conventions to follow**: Auth guard pattern — see any authenticated route handler, e.g., `src/app/api/eggs/route.ts:9-12`:
```typescript
const session = await getServerSession(authOptions);
if (!session?.user?.email) {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| Test | `npm test` | all pass |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `src/app/api/chickens/route.ts`
- `src/app/api/dynamic-lists/[type]/route.ts`

**Out of scope** (do NOT touch):
- Any other route handler
- Test files (existing tests test the lib layer directly and don't exercise route auth guards)
- `src/lib/auth.ts` or any other lib module

## Steps

### Step 1: Add session check to chickens GET handler

In `src/app/api/chickens/route.ts`, add the session guard at the top of the `GET` function, after line 8 (`try {`) and before line 9 (`await runMigrations()`):

```typescript
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await runMigrations();
    // ... rest unchanged
```

The `getServerSession` and `authOptions` imports already exist at lines 2-3.

**Verify**: `npx tsc --noEmit` → exit 0, no errors.

### Step 2: Add session check to dynamic-lists GET handler

In `src/app/api/dynamic-lists/[type]/route.ts`, add the session guard at the top of the `GET` function, after line 33 (`try {`) and before line 39 (`await runMigrations()`):

```typescript
export async function GET(
  _request: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const listType = normalizeType(params.type);
    // ... rest unchanged
```

The `getServerSession` import already exists at line 2. The `authOptions` import already exists at line 3.

**Verify**: `npx tsc --noEmit` → exit 0, no errors.

### Step 3: Run full verification

**Verify**: `npm test` → all existing tests pass. `npm run lint` → exit 0.

## Test plan

No new tests. The existing integration tests test the lib functions directly (not through route handlers), so they don't exercise auth guards. A route-level test would require mocking Next.js request objects, which isn't in the project's testing infrastructure. The typecheck + lint + manual curl check is sufficient.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0
- [ ] `npm run lint` exits 0
- [ ] `GET /api/chickens` without session returns 401
- [ ] `GET /api/dynamic-lists/breeds` without session returns 401
- [ ] `GET /api/chickens` with valid session returns 200
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

- The code at the locations above doesn't match the excerpts (codebase has drifted).
- A step's verification fails twice after a reasonable fix attempt.
- The fix requires touching an out-of-scope file.

## Maintenance notes

- If new route handlers are added in the future, they should follow the same auth guard pattern as every other handler in the project.
- The `requireAdmin()` helper in `dynamic-lists/[type]/route.ts` is used by the other verbs but not by GET — this is correct since GET should be readable by any authenticated user (not just Admin), matching the pattern used by `GET /api/chickens/[id]/route.ts` (any authenticated user).
