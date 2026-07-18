# 6. Note images are a separate table, cropped on save

- Status: Accepted
- Date: 2026-07-18

## Context

Notes need to carry images alongside their text — vet receipts, medication labels, photos of injuries. The system already has a `photos` table and a local image folder for chicken gallery / primary-photo images. The question was whether note images should reuse that table (e.g. with a nullable `note_id` to make `photos` polymorphic) or live in a new table. The second question was whether to keep the full uploaded image or only the cropped region of interest.

## Decision

Note images live in a new `note_images` table, separate from `photos`. While a note is being created or edited, the full uploaded image is held transiently; a crop region (normalized 0–1 over the original dimensions) is chosen by the AI, by the user, or both. **On note save, only the cropped region is written to disk and the full image is discarded.** The persisted file path points at the cropped image — there is no "original" to revert to.

## Consequences

- The `Photo` concept stays clean: a photo is *of the chicken* (identification, can become primary). A note image is *evidence of an event* attached to a note. The two never mix in the gallery.
- Stored note images are compact — no extraneous background, no full camera roll.
- After save, re-cropping requires re-uploading the full image. This is a deliberate trade for storage minimalism and for not retaining potentially sensitive data outside the cropped region.
- The full image is transient: discarded on save, on cancel, or by the periodic orphan sweep (see ADR 0007). If a user wants to back out of a crop, they can re-upload before saving.
- The `note_images` table carries an AI processing status and the AI's last-suggested text for retry/repro (see ADR 0007).
- New API routes are needed for note-image upload, status, and discard. The existing `photos` table and its routes are untouched.

## Alternatives considered

- **Reuse `photos` with a nullable `note_id`** — single table, fewer routes, but `Photo` becomes polymorphic and the gallery concept blurs. A "photo" would then mean either an image of the chicken or an image attached to a note, and gallery primary-photo logic would have to be guarded.
- **Keep the full image, store crop coords** — the user can re-crop after save without re-uploading, and the AI's bbox can be re-applied. But every note image retains potentially irrelevant data outside the crop, and a future reader of the table has to remember that `file_path` is the *original*, not what the user sees. Rejected as the larger retention cost outweighs the re-crop convenience.
