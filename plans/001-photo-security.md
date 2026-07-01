# Plan 001: Fix path traversal and add file validation in photo serving

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5761d68..HEAD -- src/app/api/photos/ src/app/api/chickens/*/photos/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `5761d68`, 2026-07-01

## Why this matters

The photo serving endpoint accepts a `filename` param that is used directly in `path.join()` + `readFile()` without sanitizing `..` or path separators. An authenticated user can read arbitrary server files (`.env` with DB credentials, Google OAuth secrets, NextAuth secret). Separately, the photo upload endpoint accepts any file type/size without validation, allowing malicious or oversized uploads that could exhaust the Docker volume. Fixing both closes two HIGH/MED severity security holes in the same module.

## Current state

**Photo serving** — `src/app/api/photos/[filename]/route.ts:27-33`:
```typescript
const { filename } = params;   // line 27 — from URL, unsanitized
const ext = filename.split(".").pop()?.toLowerCase() || "";
const contentType = MIME_TYPES[ext] || "application/octet-stream";
const imageDir = getImageDirectory();                     // line 32
const filePath = join(imageDir, filename);                // line 33 — traversal possible
const buffer = await readFile(filePath);                  // line 35
```

**Photo upload** — `src/app/api/chickens/[id]/photos/route.ts:71-89`:
```typescript
const formData = await request.formData();
const file = formData.get("file") as File | null;   // line 72 — no type/size check
// ...
const ext = file.name.split(".").pop() || "jpg";    // line 82 — trusts extension
const filename = `${uuidv4()}.${ext}`;
const filePath = join(imageDir, filename);
await writeFile(filePath, buffer);                   // line 90 — writes regardless
```

**Repo conventions to follow**:
- Error handling: return `NextResponse.json({ message: "..." }, { status: N })` — see `eggs/route.ts:58-70` for validation pattern.
- Allowed MIME types: the existing `MIME_TYPES` map at `photos/[filename]/route.ts:8-15` already defines the accepted image types.
- The `uuid` package (used only here at line 9) can be replaced with Node built-in `crypto.randomUUID()` — this plan does that too.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| Test | `npm test` | all pass |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `src/app/api/photos/[filename]/route.ts`
- `src/app/api/chickens/[id]/photos/route.ts`

**Out of scope** (do NOT touch, even though they look related):
- `src/lib/photos.ts` — db CRUD layer, no file I/O concerns
- `src/app/api/chickens/[id]/photos/[photoId]/route.ts` — photo metadata endpoints
- Any other route file or lib module

## Steps

### Step 1: Sanitize filename in photo serving route

In `src/app/api/photos/[filename]/route.ts`, add a path traversal guard after line 27 (`const { filename } = params`) and before line 32 (`const imageDir = getImageDirectory()`):

Add import `import { resolve } from "path";` alongside the existing `join` import.

Add a guard:
```typescript
const { filename } = params;

// Prevent path traversal: reject filenames containing path separators or parent refs
if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
  return NextResponse.json({ message: "Invalid filename" }, { status: 400 });
}
```

Remove the duplicate `import { join }` — replace with `import { join, resolve } from "path";`. And after the filePath assignment, add a check that the resolved path is within the image directory:

```typescript
const imageDir = getImageDirectory();
const filePath = join(imageDir, filename);

// Ensure resolved path stays inside image directory
if (!filePath.startsWith(resolve(imageDir))) {
  return NextResponse.json({ message: "Invalid filename" }, { status: 400 });
}
```

**Verify**: `npx tsc --noEmit` → exit 0, no errors.

### Step 2: Add file type and size validation on photo upload

In `src/app/api/chickens/[id]/photos/route.ts`, after line 72 (`const file = formData.get("file") as File | null;`) and before line 82, add validation:

```typescript
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

if (!file) {
  return NextResponse.json({ message: "file is required" }, { status: 400 });
}

if (!ALLOWED_TYPES.includes(file.type)) {
  return NextResponse.json(
    { message: `File type ${file.type} is not allowed. Accepted: ${ALLOWED_TYPES.join(", ")}` },
    { status: 400 }
  );
}

if (file.size > MAX_SIZE_BYTES) {
  return NextResponse.json(
    { message: "File size exceeds 10 MB limit" },
    { status: 400 }
  );
}
```

Also add a magic-bytes check after line 88 (`const buffer = Buffer.from(await file.arrayBuffer())`). A lightweight approach: check the first few bytes against known image signatures:

```typescript
const buffer = Buffer.from(await file.arrayBuffer());

// Verify file header (magic bytes) for common image formats
const header = buffer.slice(0, 4).toString("hex");
const VALID_HEADERS = [
  "ffd8ffe0", // JPEG
  "ffd8ffe1", // JPEG (Exif)
  "ffd8ffe2", // JPEG (ICC)
  "89504e47", // PNG
  "47494638", // GIF87a
  "47494639", // GIF89a
  "52494646", // WEBP (RIFF...WEBP)
  "424d",     // BMP
];
const isImage = VALID_HEADERS.some((h) => header.startsWith(h));
if (!isImage) {
  return NextResponse.json({ message: "File content does not match allowed image types" }, { status: 400 });
}
```

**Verify**: `npx tsc --noEmit` → exit 0, no errors.

### Step 3: Replace uuid with built-in crypto.randomUUID

In `src/app/api/chickens/[id]/photos/route.ts`, replace line 9:
```typescript
import { v4 as uuidv4 } from "uuid";
```
with:
```typescript
import { randomUUID } from "crypto";
```

Replace line 83:
```typescript
const filename = `${uuidv4()}.${ext}`;
```
with:
```typescript
const filename = `${randomUUID()}.${ext}`;
```

Remove `uuid` and `@types/uuid` from `package.json`:
- In `dependencies`: remove `"uuid": "^14.0.1"`
- In `devDependencies`: remove `"@types/uuid": "^10.0.0"`

**Verify**: `npm test` → all existing tests pass. `npx tsc --noEmit` → exit 0, no errors. Optionally run `npm ls uuid` and confirm the only uuid is a transitive one from next-auth (dev-only).

## Test plan

No new tests required for this plan — the existing integration tests cover photo CRUD at the lib layer. The security changes are in the route handler layer (request validation), which would need a full request-mocking harness not yet in the project. The typecheck + lint + existing test pass is the verification gate.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0 (all existing tests pass)
- [ ] `npm run lint` exits 0
- [ ] Path traversal: filename with `..` or `/` returns 400 (manual or curl: `GET /api/photos/%2e%2e%2f.env` → 400)
- [ ] File upload: non-image MIME type returns 400 (curl POST with text file → 400)
- [ ] File upload: file > 10 MB returns 400
- [ ] `grep -rn '"uuid"' package.json` returns no matches (direct dependency removed)
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

- The code at the locations above doesn't match the excerpts (codebase has drifted).
- A step's verification fails twice after a reasonable fix attempt.
- The fix requires touching an out-of-scope file.

## Maintenance notes

- If new image MIME types are added in the future (e.g. `image/avif`), update both `ALLOWED_TYPES` in the upload route and `MIME_TYPES` in the serving route.
- The magic-byte check covers common formats but not all. If issues arise with valid image uploads being rejected, expand `VALID_HEADERS`.
- The `MAX_SIZE_BYTES` (10 MB) is reasonable for coop photos. Adjust if users report legitimate larger photos.
