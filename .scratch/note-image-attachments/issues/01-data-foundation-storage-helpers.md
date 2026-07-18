**Triage label:** `ready-for-agent`

## What to build

Lay the data foundation for the note-image feature (ADR 0006). Add the `note_images` table to the migration in `db.ts` with: a nullable `note_id` (FK to `notes`, cascade delete) so a row can exist transiently before attachment; a `chicken_id` (FK to `chickens`, cascade) for the orphan sweep's per-chicken listing; the AI status enum column (`pending` / `processing` / `succeeded` / `failed`); nullable text columns for the AI's last-suggested text and the AI error message; the normalized 0–1 crop region columns (`crop_x_min`, `crop_y_min`, `crop_x_max`, `crop_y_max`); and the original image dimensions (`original_width`, `original_height`) used to scale the crop region. Indexes on `note_id`, `chicken_id`, and `(status, created_at)` for the orphan sweep. The migration must be idempotent (match the existing pattern of `IF NOT EXISTS` + per-`ALTER TABLE` query blocks).

Create a new data-layer module `@/lib/note_images.ts` that mirrors the shape of `@/lib/notes.ts` / `@/lib/photos.ts` — typed CRUD functions, no AI knowledge, no HTTP knowledge. The module must expose (at minimum) the lib functions listed in the spec's Data layer section: `createPendingNoteImage` (inserts a row with `note_id = NULL`, `status = 'pending'`, records the transient file path), `attachPendingNoteImageToNote` (sets `note_id`, the persisted (cropped) `file_path`, the crop region, and `status = 'succeeded'`), `updateNoteImageStatus` (status transitions + optional `ai_suggestion` / `ai_error`), `getNoteImage`, `listNoteImagesByNote`, `listPendingNoteImagesByChicken`, `discardNoteImage` (deletes the row and the file(s)), `deleteNoteImagesForNote` (cascade delete used by the note-delete path), and `sweepOrphanNoteImages(olderThanHours = 24)`. All file deletion happens in this module via `fs.unlink` on the persisted and transient paths.

Create (or extend) an image-storage helper module that owns the sharp pipeline so S2 and S3 can reuse it without duplication: a function that applies a normalized 0–1 crop region to a transient file and writes the cropped result to a destination path; a function that generates a `.webp` thumbnail (resized, fixed dimensions) from a file path; a function that validates magic bytes against the photo allowlist; a constant MIME/size allowlist matching the photos route. The AI module in slice 5 will need to read original image dimensions, so expose a `readImageDimensions` helper too.

Add integration tests mirroring the pattern in `tests/photos.integration.test.ts` / `tests/notes.integration.test.ts`: a real DB (via `ensureDatabase` + `runMigrations` in `beforeAll`), tests for create-pending, attach-to-note, list-by-note, list-pending-by-chicken, status transitions, discard (row + file deletion), delete-by-note cascade (rows), and the orphan sweep (only reaps rows where `note_id IS NULL AND created_at < threshold`).

## Acceptance criteria

- [ ] `note_images` table created via the existing `db.ts` migration in the same idempotent style as the rest of the schema, with all columns, indexes, and cascade FKs to `notes` and `chickens` listed in the spec
- [ ] `@/lib/note_images.ts` exposes the full set of lib functions from the spec's Data layer section, each with a typed return value
- [ ] File deletion is centralized in the data layer (transient and persisted paths); no other module needs to call `fs.unlink` for note-image files
- [ ] Image-storage helper module owns the sharp pipeline: apply-crop, generate-thumbnail, magic-byte validation, MIME/size allowlist, read-image-dimensions
- [ ] Integration tests cover: create-pending, attach-to-note, list-by-note, list-pending-by-chicken, status transitions, discard (row + file), delete-by-note cascade, and the orphan sweep threshold logic
- [ ] Tests run green via `npm test` (they live in the node-env Jest config, not the component one)

## Blocked by

None - can start immediately
