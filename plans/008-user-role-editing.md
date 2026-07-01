# Plan 008: Add user role editing

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5761d68..HEAD -- src/lib/users.ts src/app/api/admin/users/route.ts src/app/admin/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `5761d68`, 2026-07-01

## Why this matters

The user management system supports add and remove but not role updates. To change a Viewer to Admin (or vice versa), an admin must remove the user and re-add them, which temporarily locks the user out. Adding `updateUserRole` at the lib, API, and UI levels eliminates this workaround and makes role management consistent with the rest of the CRUD operations.

## Current state

**`src/lib/users.ts:31-48`** — Exports `addUser()`, `removeUser()`, `getUserByEmail()`, `listUsers()`. No role update function exists.

**`src/app/api/admin/users/route.ts`** — Handles `GET` (list), `POST` (add), `DELETE` (remove). No `PUT` handler.

**`src/app/admin/page.tsx`** — Lines 287-413 show the User Management section. Each user row shows email, role badge, and Remove button. No role editing controls.

**Repo conventions to follow**:
- Lib function pattern: parameterized SQL with `mssql` input types — see `users.ts:36-40` (`addUser`).
- Route validation pattern: `getSessionWithRole()` helper, body parsing with field type checks — see `admin/users/route.ts:37-63` (`POST`).
- Frontend styling: inline styles, fetch with JSON — see `admin/page.tsx:87-128` (`handleAddUser`, `handleRemoveUser`).
- The `Role` type is already defined and exported from `users.ts:4` — reuse it.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| Test | `npm test` | all pass |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `src/lib/users.ts`
- `src/app/api/admin/users/route.ts`
- `src/app/admin/page.tsx`

**Out of scope** (do NOT touch):
- `tests/auth.integration.test.ts` — existing tests must still pass unchanged
- Any other route or page

## Steps

### Step 1: Add `updateUserRole` to users lib

In `src/lib/users.ts`, after the `removeUser` function (after line 48), add:

```typescript
export async function updateUserRole(email: string, role: Role): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("email", sql.NVarChar(255), email.trim().toLowerCase())
    .input("role", sql.NVarChar(50), role)
    .query("UPDATE users SET role = @role WHERE email = @email");
}
```

**Verify**: `npx tsc --noEmit` → exit 0, no errors.

### Step 2: Add PUT handler to admin users route

In `src/app/api/admin/users/route.ts`, after the `DELETE` handler (after line 108), add a `PUT` handler:

```typescript
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionWithRole();
    if (!session) {
      return NextResponse.json(
        { message: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email || typeof email !== "string" || email.trim().length === 0) {
      return NextResponse.json(
        { message: "Email is required" },
        { status: 400 }
      );
    }

    if (!role || !["Admin", "Viewer"].includes(role)) {
      return NextResponse.json(
        { message: "Role must be Admin or Viewer" },
        { status: 400 }
      );
    }

    await updateUserRole(email, role as Role);
    return NextResponse.json({ message: "User role updated" });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
```

Update the import on line 4 to include `updateUserRole`:

```typescript
import { listUsers, addUser, removeUser, updateUserRole, type Role } from "@/lib/users";
```

**Verify**: `npx tsc --noEmit` → exit 0, no errors.

### Step 3: Add role selector to admin UI

In `src/app/admin/page.tsx`, modify the user table to include an inline role selector.

The current user row render (lines 374-409):
```tsx
{users.map((u) => (
  <tr key={u.email} style={{ borderBottom: "1px solid #eee" }}>
    <td style={{ padding: "0.5rem 0.5rem 0.5rem 0" }}>{u.email}</td>
    <td style={{ padding: "0.5rem" }}>
      <span
        style={{
          padding: "0.15rem 0.5rem",
          borderRadius: "4px",
          fontSize: "0.8rem",
          fontWeight: 600,
          background: u.role === "Admin" ? "#e3f2fd" : "#f3e5f5",
          color: u.role === "Admin" ? "#1565c0" : "#7b1fa2",
        }}
      >
        {u.role}
      </span>
    </td>
    <td style={{ textAlign: "right", padding: "0.5rem 0" }}>
      {u.email !== session?.user?.email && (
        <button
          onClick={() => handleRemoveUser(u.email)}
          style={{
            padding: "0.25rem 0.5rem",
            background: "none",
            color: "#d32f2f",
            border: "1px solid #d32f2f",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.8rem",
          }}
        >
          Remove
        </button>
      )}
    </td>
  </tr>
))}
```

Replace the role display (`<span>...</span>`) with a `select` element that allows changing the role. The span becomes:

```tsx
<select
  value={u.role}
  onChange={(e) => handleRoleChange(u.email, e.target.value as "Admin" | "Viewer")}
  style={{
    padding: "0.15rem 0.5rem",
    borderRadius: "4px",
    fontSize: "0.8rem",
    fontWeight: 600,
    background: u.role === "Admin" ? "#e3f2fd" : "#f3e5f5",
    color: u.role === "Admin" ? "#1565c0" : "#7b1fa2",
    border: "1px solid",
    borderColor: u.role === "Admin" ? "#1565c0" : "#7b1fa2",
    cursor: "pointer",
  }}
>
  <option value="Viewer">Viewer</option>
  <option value="Admin">Admin</option>
</select>
```

Add the `handleRoleChange` function alongside the existing `handleRemoveUser` (after line 128):

```typescript
async function handleRoleChange(email: string, newRole: "Admin" | "Viewer") {
  try {
    const res = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: newRole }),
    });

    if (res.ok) {
      await fetchUsers();
    }
  } catch {
    // ignore
  }
}
```

**Verify**: `npx tsc --noEmit` → exit 0, no errors.

### Step 4: Run full verification

**Verify**: `npm test` → all existing tests pass.
**Verify**: `npm run lint` → exit 0.

## Test plan

No new tests. The existing auth integration test (`tests/auth.integration.test.ts`) tests `addUser`, `removeUser`, `getUserByEmail`, and `listUsers` — these must still pass. The new `updateUserRole` function follows the same pattern as `addUser`.

Manual verification:
1. Navigate to `/admin` as an Admin user
2. See the role dropdown next to each user in the user list
3. Change a user's role from "Viewer" to "Admin" using the dropdown
4. Confirm the dropdown updates and the role badge changes color
5. Sign out and sign in as the changed user — should now have Admin privileges

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0
- [ ] `npm run lint` exits 0
- [ ] `updateUserRole` exported from `src/lib/users.ts`
- [ ] `PUT /api/admin/users` accepts `{ email, role }` and returns 200
- [ ] `PUT /api/admin/users` without admin session returns 403
- [ ] Admin UI shows role dropdown for each user (except current admin — only Remove is shown)
- [ ] Changing role via dropdown calls `PUT /api/admin/users` and refreshes the user list
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

- The code at the locations above doesn't match the excerpts (codebase has drifted).
- A step's verification fails twice after a reasonable fix attempt.
- The fix requires touching an out-of-scope file.

## Maintenance notes

- The role selector shows for all users, including the currently logged-in admin. The plan leaves the existing "don't show Remove for self" logic unchanged; the role dropdown still shows for self (allowing an admin to demote themselves). This is intentional — the admin can demote themselves, which is consistent with the current ability to remove themselves (by directly removing from DB). If self-demotion should be blocked, add `u.email !== session?.user?.email` guard around the dropdown.
- The `handleRoleChange` function uses a simple fetch with no confirmation dialog. For a small trusted user base this is acceptable. Add a `window.confirm()` dialog if desired:
  ```typescript
  if (!window.confirm(`Change role for ${email} to ${newRole}?`)) return;
  ```
