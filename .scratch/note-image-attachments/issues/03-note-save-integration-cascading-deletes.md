**Triage label:** `ready-for-agent`

## What to build

Wire note images into the note-save lifecycle so a saved note carries the cropped images, the transient files are gone, and the persisted files are exactly the cropped regions. Extend the existing `POST /api/chickens/[id]/notes` and `PUT /api/chickens/[id]/notes/[noteId]` endpoints to accept (in addition to `content` and `date`): `imageIds: number[]` and a per-image `crop` override (a normalized 0–1 region, mirroring the structure the AI module will use). The save flow must: (1) create or update the note; (2) for each `imageId`, look up the row, verify the user has permission to attach it (`recorded_by` matches the session email, or Admin), and call the image-storage helper to apply the user's chosen crop (or the AI's bbox if present, or "no crop" = full image) to the transient file via `sharp.extract()`, write the cropped result to a new persisted path, generate the persisted-file thumbnail, delete the transient file + its thumbnail, and call `attachPendingNoteImageToNote` to update the row; (3) for any pending image belonging to this chicken that was not referenced in the save body, call `discardNoteImage` so no orphan files leak (story 26). The save response is the note; the frontend can refetch note images separately. Because `attachPendingNoteImageToNote` is now strict (slice 01b throws `NoteImageNotPendingError` on a row that's already attached), the route must surface that as a `409 Conflict` response so a buggy client is caught loudly rather than silently.

Make note deletion also clean up files. The current `DELETE /api/chickens/[id]/notes/[noteId]` relies on the FK cascade to remove the rows; in this slice, also iterate the note's note images and `fs.unlink` the persisted files + their thumbnails before (or in the same transaction as) the row delete. The data layer's `deleteNoteImagesForNote` (row-first, ENOENT-tolerant per slice 01b) should own the file cleanup so the route is a thin wrapper.

Chicken delete: **this slice adds the chicken `DELETE` route** (it does not exist prior to this feature). Add `DELETE /api/chickens/[id]` as a hard delete (no soft-delete column on `chickens`); Admin-only. The new route: (1) walks the chicken's note-image files via a new data-layer function `deleteNoteImageFilesForChicken(chicken_id)` (captures paths via `OUTPUT deleted.file_path, deleted.thumbnail_path` from the impending cascade, then unlinks), (2) deletes the chicken row — the SQL FK cascade removes its notes and their note_images rows, and (3) returns 204. The file walk must complete before the chicken row delete (or be wrapped in a transaction) so a crash leaves the chicken still in the DB with its files gone, not the reverse.

Integration tests cover: POST a note with one image (the persisted file is the cropped region, the transient is gone, the row is `succeeded` with the right crop and `note_id`); POST a note with multiple images and per-image crops; POST a note and leave a pending image un-referenced (the un-referenced one is discarded); PUT an existing note to attach new images; the strict-attach error path returns 409 when an `imageId` is not pending; DELETE a note with images (rows gone via cascade, files gone); DELETE a chicken with notes-with-images (files gone, rows gone via cascade).

## Acceptance criteria

- [ ] Note POST accepts `imageIds` + per-image crop overrides; applies the crop, writes the persisted file, generates the persisted thumbnail, deletes the transient file + thumbnail, updates the row to `succeeded` with the crop region
- [ ] Note PUT does the same on edit
- [ ] Un-referenced pending images for the chicken are discarded on note save
- [ ] A `NoteImageNotPendingError` from the data layer surfaces as a `409 Conflict` from the note-save route (not a 500)
- [ ] Note DELETE cleans up the note's note-image files (rows cascade via FK, files are unlinked)
- [ ] `DELETE /api/chickens/[id]` is added in this slice, Admin-only, hard delete; walks note-image files via the data layer before deleting the chicken row so the `images/` folder stays clean
- [ ] Permission check on attach: the user must own the pending image, or be Admin
- [ ] Integration tests cover the full save flow (single image, multiple images, per-image crops), the strict-attach 409 path, the un-referenced-discard behaviour, and the cascading file cleanup for both note and chicken delete

## Blocked by

- Issue 01 - Data foundation + storage helpers
- Issue 01b - Data layer refinements (strict attach, row-first unlink, sweep index)
- Issue 02 - Note-image HTTP surface
