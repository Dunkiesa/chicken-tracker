**Triage label:** `ready-for-agent`

## What to build

Harden the note-image data layer before slice 2 (HTTP surface) builds on top of it. Three concerns surfaced in the code review of slice 1:

1. **Orphan-sweep index serves the wrong query.** The migration created `IX_note_images_status_created_at` on `(status, created_at)`, justified in the spec as "for the orphan sweep". The sweep's actual filter is `note_id IS NULL AND created_at < threshold` (it never filters on `status`), so that index never serves the query it was named for. Add `IX_note_images_note_id_created_at` on `(note_id, created_at)` and drop `IX_note_images_status_created_at`. The migration stays idempotent.
2. **`attachPendingNoteImageToNote` silently no-ops on re-attach.** The current implementation checks `if (existing.note_id !== null) return existing;` — a bug in a caller that double-attaches is masked. Tighten the contract: throw a typed error (e.g. `NoteImageNotPendingError`) when the row is not in the `pending` state (i.e. `note_id IS NOT NULL`). Slice 2's PATCH (re-crop) and slice 3's note-save only ever call attach on a `pending` row, so this should be a strict one-shot transition.
3. **File deletion is ordered before row deletion.** `discardNoteImage`, `deleteNoteImagesForNote`, and `sweepOrphanNoteImages` all unlink files first, then delete the row. A crash mid-sequence leaves a row pointing at a deleted file (the only state from which the sweep cannot recover). Reorder: do the row `DELETE` first (capturing the file paths via `OUTPUT deleted.file_path, deleted.thumbnail_path`), then unlink the captured paths. ENOENT on the unlink is swallowed (the file is already gone — that's fine, the row is the source of truth). Other unlink errors propagate.

## Acceptance criteria

- [ ] `IX_note_images_note_id_created_at` exists on `(note_id, created_at)`; `IX_note_images_status_created_at` no longer exists. Both transitions are idempotent under re-running `runMigrations`.
- [ ] `attachPendingNoteImageToNote` throws a typed error when the row's `note_id` is not null (i.e. already attached). The error has a stable name/code so the API route in slice 3 can translate it to a 409.
- [ ] `discardNoteImage` deletes the row first, then unlinks the persisted and thumbnail files. ENOENT on the unlink is silently swallowed; other errors propagate.
- [ ] `deleteNoteImagesForNote` uses `DELETE ... OUTPUT deleted.file_path, deleted.thumbnail_path FROM note_images WHERE note_id = @note_id` (or equivalent) to capture paths in the same statement that removes the rows, then unlinks each captured path. ENOENT is swallowed.
- [ ] `sweepOrphanNoteImages` reorders the same way: `DELETE ... OUTPUT` for the orphan set, then unlink. The threshold is computed once at the top of the function and reused for both the SELECT (if any preview is needed) and the DELETE.
- [ ] Integration tests cover: (a) `attachPendingNoteImageToNote` throws on a re-attach, (b) `discardNoteImage` leaves no orphan row when the file is already gone, (c) `deleteNoteImagesForNote` unlinks files for rows that existed at DELETE time and tolerates a row whose file vanished between the SELECT and the unlink, (d) the new `(note_id, created_at)` index is the one the orphan sweep uses (verified by inspecting `sys.indexes` in the test, or by an `EXPLAIN`-style check).
- [ ] No new public surface beyond the listed behavior changes — keep the function signatures and return types stable so slices 2–6 don't need to change.

## Blocked by

- None — picks up directly after slice 1.
