**Triage label:** `ready-for-agent`

## What to build

Make the note-image feature usable from the UI in manual mode (no AI). The Add Note dialog gets an "Add image" affordance (`<input type="file" accept="image/*" capture="environment">` so phone users can use the camera). The dialog maintains a per-image list as the user adds files: each row shows a thumbnail (served from the image-read route added in slice 2), a crop overlay (reusing the existing `CropDialog` from the primary-photo flow — it already speaks `react-easy-crop` and the same area shape), a Remove button, and a manual-status indicator. The status is always "ready" in this slice — there is no processing state yet (that's slice 6). The save button is enabled; on click the dialog POSTs to the note endpoint with `imageIds` and the chosen crop per image (the existing endpoint extension from slice 3). The dialog must handle the `pending` rows correctly: it must show the user images they uploaded in the same dialog session, even if they hit "Add image" several times.

The Edit Note dialog mirrors the Add Note dialog — same image controls, same crop behaviour, same save flow — so a user can add/remove images to an existing note (stories 27–30). The current edit dialog is an inline dialog inside the per-note `NoteItem`; the image controls slot into the same place.

The notes log gets inline image rendering: each `NoteItem` shows the note's note images as thumbnails beneath the content; clicking a thumbnail opens a lightbox dialog (the same pattern as the chicken photos lightbox that already exists in the same file). The images are fetched once per page load via the `?noteId=...` list endpoint from slice 2; group them client-side by note.

Validation: the UI surfaces server-side error messages verbatim for size / type / magic-byte rejections (stories 42, 43, 44 — the server returns the messages, the UI just displays them). The "Add image" button is disabled while an upload is in flight so the user can't pile up concurrent uploads; failed uploads keep the file input armed so the user can retry.

Component tests cover: the Add Note dialog accepts an image and shows it in the list; the user can adjust the crop and the dialog sends the right `imageIds` + crops on save; the Edit Note dialog mirrors; the notes log renders note images and the lightbox opens on click.

## Acceptance criteria

- [ ] Add Note dialog has an "Add image" button using `<input type="file" accept="image/*" capture="environment">` so phones offer the camera
- [ ] Each image in the dialog shows a thumbnail, a crop overlay via the existing `CropDialog`, and a Remove control
- [ ] Save sends `imageIds` + per-image crops to the note endpoint (which slice 3 already accepts)
- [ ] Server-side validation errors (size, type, magic bytes) are surfaced in the dialog as MUI Alerts
- [ ] Edit Note dialog mirrors the Add Note dialog (same image controls, same save flow)
- [ ] Notes log renders note image thumbnails inline in each `NoteItem`
- [ ] Clicking a note image thumbnail opens a lightbox dialog
- [ ] Component tests pass via `npm run test:components`; they live in `tests/components/`

## Blocked by

- Issue 01 - Data foundation + storage helpers
- Issue 02 - Note-image HTTP surface
- Issue 03 - Note-save integration + cascading deletes
