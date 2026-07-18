**Triage label:** `ready-for-agent`

## What to build

Expose the full HTTP surface for note images so the data layer is reachable from the network. The upload endpoint accepts a multipart file, validates size, MIME, and magic bytes using the helpers from slice 1, writes the file to the transient path under `IMAGE_DIR/notes/_pending/{uuid}.{ext}`, generates a thumbnail alongside it, and inserts the pending row. It returns the row immediately with `status = 'pending'`. No AI work happens here — the AI fire-and-forget is added in slice 6; in this slice the row simply stays in `pending` after upload.

A new image-read route serves files under `IMAGE_DIR/notes/` (both `_pending/` and persisted). It mirrors the existing photo-read route's auth + path-traversal guards (rejects names with `..` / `/` / `\`, re-resolves the joined path under `IMAGE_DIR`, serves bytes with the right `Content-Type` and a cache header). A new namespace is cleaner than reusing the photos route.

List endpoints follow the spec: list images attached to a saved note (`?noteId=...`), list pending for a chicken (`?pending=true`), and fetch a single image by id. The single-image fetch is the canonical state the UI uses to reconcile when the SSE stream drops and reconnects (story 47).

A `PATCH` endpoint on a single image handles two actions during the dialog lifetime: adjust the crop region (only allowed while the row is `pending` or `succeeded` with no `note_id` set — i.e. before save), and discard (idempotent delete of the row + file). A `discard-batch` endpoint accepts a list of image ids and discards them; the frontend calls this from the dialog's cancel button. Permission model on write routes follows the note's: Admin any, Viewer only their own (`recorded_by` matches the session email).

A `POST /api/internal/sweep-orphans` route calls the data layer's `sweepOrphanNoteImages` and returns a count. The route is intentionally separate from the in-process mutation paths so the operator can wire it to a cron job or the Docker host without the in-process app doing the scheduling. (How it's scheduled is out of scope per the spec.)

Integration tests cover: upload with auth, size rejection, MIME rejection, magic-byte rejection; the various GET endpoints (auth, scoping, 404s); the discard-batch idempotency; the PATCH crop and discard actions; the sweep route's threshold behaviour.

## Acceptance criteria

- [ ] `POST /api/chickens/[id]/notes/images` accepts a multipart file, writes transient file + thumbnail under `IMAGE_DIR/notes/_pending/`, inserts a `pending` row, returns the row (no AI yet)
- [ ] Image-read route serves files under `IMAGE_DIR/notes/` with the same auth + path-traversal pattern as the photos read route
- [ ] List-by-note, list-pending-by-chicken, and get-one endpoints return the right data with auth and per-chicken scoping
- [ ] `PATCH` on a single image adjusts the crop region (pre-save) and discards (idempotent)
- [ ] `discard-batch` endpoint accepts `{ imageIds: number[] }`, is idempotent, and is what the cancel button will call
- [ ] All write routes use NextAuth + the "admin any, viewer own" permission model
- [ ] `POST /api/internal/sweep-orphans` invokes the data layer's sweep and returns a count
- [ ] Integration tests cover all of the above (auth, validation rejections, scoping, idempotency, sweep threshold)

## Blocked by

- Issue 01 - Data foundation + storage helpers
- Issue 01b - Data layer refinements (strict attach, row-first unlink, sweep index)
