**Triage label:** `ready-for-agent`

## What to build

Wire note images into the note-save lifecycle so a saved note carries the cropped images, the transient files are gone, and the persisted files are exactly the cropped regions. Extend the existing `POST /api/chickens/[id]/notes` and `PUT /api/chickens/[id]/notes/[noteId]` endpoints to accept (in addition to `content` and `date`): `imageIds: number[]` and a per-image `crop` override (a normalized 0–1 region, mirroring the structure the AI module will use). The save flow must: (1) create or update the note; (2) for each `imageId`, look up the row, verify the user has permission to attach it (`recorded_by` matches the session email, or Admin), and call the image-storage helper to apply the user's chosen crop (or the AI's bbox if present, or "no crop" = full image) to the transient file via `sharp.extract()`, write the cropped result to a new persisted path, generate the persisted-file thumbnail, delete the transient file + its thumbnail, and call `attachPendingNoteImageToNote` to update the row; (3) for any pending image belonging to this chicken that was not referenced in the save body, call `discardNoteImage` so no orphan files leak (story 26). The save response is the note; the frontend can refetch note images separately.

Make note deletion also clean up files. The current `DELETE /api/chickens/[id]/notes/[noteId]` relies on the FK cascade to remove the rows; in this slice, also iterate the note's note images and `fs.unlink` the persisted files + their thumbnails before (or in the same transaction as) the row delete. The data layer's `deleteNoteImagesForNote` should own the file cleanup so the route is a thin wrapper.

Chicken delete: extend `DELETE /api/chickens/[id]` (or whatever the existing chicken-delete path is — check) so the cascading note-image file cleanup also happens. The FK cascade already removes the rows; the new behaviour is to walk the chicken's note-image files before the delete and unlink them. Centralize the file-walk + unlink in the data layer (e.g. `deleteNoteImageFilesForChicken`) so the route is small.

Integration tests cover: POST a note with one image (the persisted file is the cropped region, the transient is gone, the row is `succeeded` with the right crop and `note_id`); POST a note with multiple images and per-image crops; POST a note and leave a pending image un-referenced (the un-referenced one is discarded); PUT an existing note to attach new images; DELETE a note with images (rows gone via cascade, files gone); DELETE a chicken with notes-with-images (files gone).

## Acceptance criteria

- [ ] Note POST accepts `imageIds` + per-image crop overrides; applies the crop, writes the persisted file, generates the persisted thumbnail, deletes the transient file + thumbnail, updates the row to `succeeded` with the crop region
- [ ] Note PUT does the same on edit
- [ ] Un-referenced pending images for the chicken are discarded on note save
- [ ] Note DELETE cleans up the note's note-image files (rows cascade via FK, files are unlinked)
- [ ] Chicken DELETE cleans up that chicken's note-image files (via notes → note_images)
- [ ] Permission check on attach: the user must own the pending image, or be Admin
- [ ] Integration tests cover the full save flow (single image, multiple images, per-image crops), the un-referenced-discard behaviour, and the cascading file cleanup for both note and chicken delete

## Blocked by

- Issue 01 - Data foundation + storage helpers
- Issue 02 - Note-image HTTP surface
