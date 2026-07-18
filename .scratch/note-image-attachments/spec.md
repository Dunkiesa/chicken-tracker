# Note Image Attachments (with optional AI assist)

- Status: ready-for-agent
- Date: 2026-07-18
- Feature: `.scratch/note-image-attachments/`
- Domain: `CONTEXT.md` (single context)
- ADRs respected: `0006-note-images-separate-table-cropped-on-save`, `0007-async-ai-with-file-config`

## Problem Statement

The chicken notes log is currently text-only. Some notes would benefit from visual evidence — a vet receipt, a medication label, a photo of an injury or a scale reading — but the user has no way to attach anything to a note beyond typing characters. As a result, the user either skips the visual entirely (losing useful context) or tries to transcribe it manually (error-prone, slow, and painful for things like a receipt with many small lines). The same problem shows up when capturing scale weight readings and other "read-and-type" data: the user sees a value, has to key it in, and has no fallback if their typing is wrong.

## Solution

Allow notes to carry zero or more cropped note images (ADR 0006), with optional AI assistance that suggests the text content and a crop region of interest (ADR 0007). The AI runs in the background so the user can keep working in the dialog while it processes. AI is per-deployment configurable — local (llama.cpp with a vision-language model such as Gemma 4 12B) or a subscription API — via a single YAML file whose presence is the on/off signal. When the file is absent, the feature degrades gracefully to manual text entry and manual crop, with no UI difference other than the absence of AI suggestions.

## User Stories

**Setup & configuration**

1. As a user, I want the system to gracefully fall back to manual text entry and manual crop when no AI provider is configured, so that the feature works on a fresh deployment without any extra setup.
2. As a user, I want to enable AI by creating `./config/ai.yaml` with the expected fields, so that the system picks up AI on the next request without a restart.
3. As a user, I want the AI config to work for both a local HTTP endpoint (e.g. llama.cpp) and a subscription vision API, so that I can switch providers by editing one file.
4. As a user, I want the prompt in the AI config to support multi-line text and `${...}` substitutions (e.g. image dimensions), so that I can iterate on it without escape-character gymnastics.
5. As a user, I want the AI config to support `extra_args` (e.g. llama.cpp slot pinning), so that I can control server-side request shaping without code changes.
6. As a user, I want the AI's response contract (strict JSON shape) to be the same regardless of provider, so that switching providers is a config change rather than a code change.

**Adding an image while creating a note**

7. As a user, I want to add one or more images to a note while creating it, so that I can attach visual evidence to the note's text.
8. As a user, I want to use my phone's camera to capture an image for a note, so that I can document what I'm seeing in the moment.
9. As a user, I want each image to show a "Processing..." badge while AI runs, so that I know the system is working.
10. As a user, I want to keep working in the Add Note dialog while images process, so that I don't have to wait between actions.
11. As a user, I want to add multiple images to a note, so that I can attach several pieces of evidence in one go.
12. As a user, I want each image to have its own AI processing status (pending / processing / succeeded / failed), so that I can see each one independently.
13. As a user, I want the AI to extract text from images that contain text (e.g. medication labels, receipts) and append that text to the note's content field, so that I have a starting point to review and edit.
14. As a user, I want the AI to generate a caption for images that don't have text (e.g. a photo of an injury), so that I have a useful starting point even when there's nothing to OCR.
15. As a user, I want the AI to suggest a crop region for the important content in the image, so that I don't have to drag a box manually.
16. As a user, I want to be able to adjust the AI's suggested crop, so that I can fine-tune what ends up in the note.
17. As a user, I want to be able to override the AI's suggested text by editing the content field, so that the final note reflects my own wording.
18. As a user, I want to remove an image from a note before saving, so that I don't attach something I changed my mind about.

**AI failure handling**

19. As a user, I want failed AI processing to be clearly indicated on the image, so that I know to retry or ignore without confusion.
20. As a user, I want a "Retry" button on a failed image, so that I can re-run the AI without re-uploading.
21. As a user, I want the note to remain saveable when an image has failed AI processing, so that a flaky model doesn't block the entire note.
22. As a user, I want the system to be transparent about which text in the note's content was AI-suggested vs typed manually (e.g. by visual separation), so that I trust the final note.

**Saving the note**

23. As a user, I want the Save button to be disabled while any image is still processing, so that I don't accidentally save an inconsistent state.
24. As a user, I want the note to be saved with the cropped regions (not the full images), so that the note is compact and contains only the important content.
25. As a user, I want the full uploaded images to be discarded on save, so that no extraneous data is retained outside the cropped region.
26. As a user, I want any pending images that I didn't reference in the saved note to be discarded, so that I don't leak orphan files.

**Editing an existing note**

27. As a user, I want to add images to an existing note, so that I can enrich a note I created earlier.
28. As a user, I want to remove images from an existing note, so that I can refine the note over time.
29. As a user, I want the Edit Note dialog to mirror the Add Note dialog's image controls, so that the experience is consistent.
30. As a user, I understand that re-cropping an already-saved image requires re-uploading the full image, since the original is discarded on save — so I expect a clear path to re-upload if I want a different crop.

**Cancelling a draft**

31. As a user, I want to cancel the Add/Edit Note dialog and have all my pending images discarded, so that I don't leave orphan files on the server.
32. As an operator, I want a periodic safety-net cleanup for any pending images orphaned by a client crash or network failure, so that the image folder doesn't fill up with stale data.

**Viewing notes**

33. As a user, I want to see the cropped images inline within a note (on the chicken profile's notes log), so that I can review the visual evidence alongside the text.
34. As a user, I want to click a note image to see it full-size, so that I can read details that don't fit in the thumbnail.
35. As a user, I want note images to render with a generated thumbnail for fast loading, so that the page is responsive even with several images.
36. As a user, I want note images to appear in the same chronological order as the rest of the note (newest first), so that the timeline reads naturally.

**Permissions**

37. As an Admin, I can add, edit, and delete any note (and its images) for any chicken.
38. As a Viewer, I can add notes (and images) to any chicken, and I can edit or delete only my own notes (and their images).
39. As any user, I have full add/edit/delete capabilities whether or not the AI is configured — the AI is an aid, never a gate.

**Cascading deletes**

40. As a user, when I delete a note, all of its note images are deleted (DB rows plus the files on disk), so that I don't leave dangling files behind.
41. As a user, when a chicken is deleted, all of its notes and note images are deleted (consistent with the existing photo behavior). **Note:** the chicken `DELETE` route does not exist prior to this feature; it is added in this slice. The route performs a hard delete (no soft-delete column on `chickens`); the SQL FK cascade removes the chicken's notes and their note images, and a pre-delete walk in the data layer unlinks every note-image file the chicken owns so the `images/` folder stays clean.

**Image constraints**

42. As a user, I want clear error messages for unsupported file types, so that I know which formats are accepted.
43. As a user, I want clear error messages for files over the size limit, so that I know how to resize or compress before retrying.
44. As an operator, I want the system to validate file content (magic bytes), not just the MIME type, so that a malicious or corrupt file can't slip through.

**Status updates**

45. As a user, I want real-time AI status updates pushed to the dialog (SSE), so that the "Processing..." badge flips to "AI suggested" without me manually refreshing.
46. As a user, I want AI status updates to be scoped to my own actions, so that I don't see other users' processing states.
47. As a user, if the SSE connection drops and I reopen the dialog, I want the latest known status to be fetched (so that "stuck" badges don't persist), so that I have a consistent view.

## Implementation Decisions

### Database

- A new `note_images` table mirrors the `photos` table's structure for the columns they share, plus columns specific to note images: nullable `note_id` (FK to `notes`, with cascade), `chicken_id` (FK to `chickens`, with cascade), the AI status enum (`pending` / `processing` / `succeeded` / `failed`), the AI's last-suggested text (kept for retry/repro), the AI error text (set on failure), the normalized 0–1 crop region (`crop_x_min`, `crop_y_min`, `crop_x_max`, `crop_y_max`, all nullable), the original image dimensions (`original_width`, `original_height`) used to scale the crop, and a nullable `thumbnail_path` for the persisted thumbnail (mirroring `photos.thumbnail_path`).
- A migration creates the table, indexes on `note_id`, `chicken_id`, and `(note_id, created_at)` to serve the orphan sweep, and foreign keys to `notes` and `chickens` with `ON DELETE CASCADE` (so deleting a note or a chicken cleans up note images). The index chosen for the sweep matches the sweep's actual filter (`note_id IS NULL AND created_at < threshold`); a `(status, created_at)` index would not serve that query.
- `note_id` is nullable so an image can exist transiently (uploaded but not yet attached to a saved note).
- The orphan sweep deletes rows where `note_id IS NULL AND created_at < now() - interval 24 hour`, scheduled by a periodic job (cron-style invocation; the implementation detail of *how* it's scheduled is out of scope for the data layer).

### Data layer (`@/lib/note_images.ts`)

- Mirrors the shape of `@/lib/notes.ts` and `@/lib/photos.ts`: typed CRUD functions, no knowledge of AI, no knowledge of HTTP. The data layer never calls `fs.unlink` directly — it delegates to `@/lib/image-storage.ts` (below) for every file operation. The data layer is the only caller of image-storage for note-image files; the API routes never touch the image-storage module directly for note images.
- Functions exposed:
  - `createPendingNoteImage({ chicken_id, file_path, original_width, original_height, recorded_by })` — inserts a row with `note_id = NULL`, `status = 'pending'`. The transient file lives at `IMAGE_DIR/notes/_pending/{file_path}`; the persisted file path recorded in the row is also the transient path at this stage.
  - `attachPendingNoteImageToNote(note_image_id, note_id, { cropped_file_path, crop_x_min, crop_y_min, crop_x_max, crop_y_max })` — called by the note-save API after it has applied the crop to disk; updates the row to set `note_id`, the persisted (cropped) `file_path`, the crop region, and `status = 'succeeded'`. **Strict one-shot:** the function throws if the row is not currently in `pending` state (already attached, processing, succeeded, or failed) so a buggy code path that calls it twice is caught loudly rather than silently no-op'd.
  - `updateNoteImageStatus(note_image_id, status, { ai_suggestion?, ai_error? })` — moves the row through the AI lifecycle.
  - `getNoteImage(note_image_id)`, `listNoteImagesByNote(note_id)`, `listPendingNoteImagesByChicken(chicken_id)` — read paths.
  - `discardNoteImage(note_image_id)` — deletes the row and the file(s). Used on user cancel and on AI failure when the user removes the image.
  - `deleteNoteImagesForNote(note_id)` — cascade delete used by the note-delete path. Uses `DELETE ... OUTPUT deleted.file_path, deleted.thumbnail_path` to capture paths in the same transaction that removes the rows, then unlinks the files.
  - `sweepOrphanNoteImages(olderThanHours = 24)` — periodic job.
- The data layer does not call AI. It only reads/writes rows and (via image-storage) deletes files.
- **File-deletion ordering** — every code path that removes a row and its file(s) deletes the row first, then unlinks the file(s). If the unlink fails (file missing, permission denied, ENOENT) the row is still gone and any orphan file is left for the next sweep. A crash mid-sequence cannot leave a row pointing at a deleted file because the file unlink happens last, after the row is committed.
- **Idempotency** — every delete path (discard, delete-by-note, sweep) is tolerant of "file already gone" (ENOENT is swallowed) and "row already gone" (no rows affected → return 0 / false). This makes them safe to call twice from a retry or a batch endpoint.

### Image-storage helper (`@/lib/image-storage.ts`)

- Owns the sharp pipeline so the note-images slice and the existing photos slice share the same primitives. The data layer calls into this module; the API routes do not call it directly for note images.
- Exports:
  - `applyCrop(sourcePath, destinationPath, crop: CropRegion, originalDimensions: ImageDimensions)` — applies a normalized 0–1 crop region to a source file and writes the result. Clamps the region into `[0, 1]` and enforces a 1×1 minimum extract size.
  - `generateThumbnail(sourcePath, destinationPath)` — resizes the source to the configured 300×300 cover-fit thumbnail and writes a `.webp` (quality 85).
  - `validateImageMagicBytes(buffer: Buffer)` — returns `true` if the first 4 bytes match any of the allowlist headers (JPEG / PNG / GIF / WEBP / BMP).
  - `readImageDimensions(sourcePath)` — returns `{ width, height }` for the source image.
  - `deleteImageFile(relativePath)` — unlinks a file under `IMAGE_DIR`, swallowing `ENOENT`. Rejects paths that escape `IMAGE_DIR`.
  - `ALLOWED_MIME_TYPES`, `MAX_FILE_SIZE_BYTES` — the same allowlist and 10 MB cap the photos route already uses.
  - `resolveImagePath(relativePath)` — resolves a path under `IMAGE_DIR` and throws if it escapes the directory (path-traversal guard).
- This module is the only place in the codebase that calls `sharp` for note-image work and the only place that calls `fs.unlink` for note-image files.

### AI module (`@/lib/ai/`)

- Single module boundary with three responsibilities: config loading, provider call, response parsing. Plus a thin orchestrator that ties them together and emits status events.
- A `loadAIConfig()` function reads `./config/ai.yaml` and returns a typed object, or `null` if the file is missing (AI disabled). A failed parse returns `null` and logs the parse error.
- A `isAIEnabled()` function — a thin wrapper over `loadAIConfig` returning a boolean.
- A `callAIProvider(config, imageBytes, mimeType)` function POSTs to `config.url` with the configurable prompt (after `${...}` substitution) and the image, and returns the raw response text. The function is provider-agnostic — it speaks the OpenAI chat-completions shape (with the image as a base64 data URL in the message content), which works for llama.cpp's OpenAI-compatible endpoint and the major subscription APIs.
- A `parseAIResponse(responseText)` function parses the strict JSON shape `{"text": string, "bbox": [x_min, y_min, x_max, y_max] | null}` and returns a typed result, or throws a typed error on parse / schema failure.
- A `processNoteImage(note_image_id)` orchestrator:
  1. Reads the transient image from disk.
  2. Loads config; if disabled, marks the image with a "no AI configured" status and emits the event.
  3. Calls the provider, parses the response, writes the AI suggestion / bbox onto the row, marks status = `succeeded`, and emits the event.
  4. On any failure (parse, HTTP, schema), marks the row `failed` with the error message and emits the event.
- A `subscribeToStatusEvents(userEmail, callback)` function for the SSE endpoint. Events are scoped by `recorded_by` on the row.
- A small in-process pub-sub (a `Map<userEmail, Set<callback>>`) backs the SSE. No Redis, no external queue. Single Node process.
- One auto-retry on parse / schema failure before marking `failed`. After that, retry is user-driven via the dialog's Retry button.

### API routes

- `POST /api/chickens/[id]/notes/images` — accepts a multipart upload (file), validates size, MIME, and magic bytes (same allowlist as photos), writes the file to `IMAGE_DIR/notes/_pending/{uuid}.{ext}`, inserts the pending row, fires-and-forgets `processNoteImage` (does not await), and returns the row immediately.
- `GET /api/chickens/[id]/notes/images?noteId=...` — list note images attached to a saved note.
- `GET /api/chickens/[id]/notes/images?pending=true` — list pending images for the chicken (used by the dialog to recover state on reload).
- `GET /api/chickens/[id]/notes/images/[imageId]` — fetch a single note image (with its current AI status).
- `PATCH /api/chickens/[id]/notes/images/[imageId]` — adjust crop (during edit, before save), retry AI, or discard.
- `POST /api/chickens/[id]/notes/images/discard-batch` — explicit batch cleanup when the user cancels the dialog. Body: `{ imageIds: number[] }`. Idempotent.
- `GET /api/chickens/[id]/notes/images/events` — Server-Sent Events stream scoped to the authenticated user, emits `processing` / `succeeded` / `failed` events for their note images.
- The existing `POST /api/chickens/[id]/notes` and `PUT /api/chickens/[id]/notes/[noteId]` are extended to accept `imageIds: number[]` and per-image `crop` overrides. On save, the API:
  1. Creates or updates the note.
  2. For each `imageId`, applies the user-chosen crop (or the AI's suggestion, or "no crop" = full image) using `sharp.extract()` to the transient file, writes the cropped result as the persisted file, deletes the transient file, and calls `attachPendingNoteImageToNote`.
  3. Discards any pending images not referenced (caller forgot about them, or they were already in `failed` state).
- All routes use the existing NextAuth session check; note-image write routes follow the note's "viewers can edit their own" permission model.
- A periodic sweep route (e.g. `POST /api/internal/sweep-orphans`) is called by a cron job or the Docker host to invoke `sweepOrphanNoteImages`. (For v1, this is an explicit route rather than an in-process timer, so it's easy to disable in development.)

### Frontend

- The Add Note dialog gets an "Add image" affordance (file picker or camera capture via `<input type="file" accept="image/*" capture="environment">`).
- Each image in the dialog shows: a thumbnail, a crop overlay (drag to adjust), an AI status badge, and — on success — the AI's text suggestion applied to the content field. A "Retry" / "Discard" / "Adjust crop" control is available.
- The dialog subscribes to the SSE channel via an `EventSource` (with auto-reconnect and a fallback `GET` to reconcile state on reconnect) and updates image statuses in real time.
- Save is disabled while any image is in `processing`. Failed images do not block save (per user story 21).
- The Edit Note dialog mirrors the Add Note dialog (same image controls, same SSE subscription).
- A note's display in the notes list shows inline image thumbnails; clicking opens a lightbox.
- The note-image read path serves files through the existing `/api/photos/[filename]` route, or a new `/api/notes/images/[filename]` route if we want a separate namespace.

### Storage

- The existing `IMAGE_DIR` (default `./images`) is reused. A new subfolder `IMAGE_DIR/notes/` holds both transient pending files (under `_pending/`) and persisted (cropped) files.
- On note save, the API applies the crop using `sharp.extract()` to the transient file, writes the cropped result as the persisted file, and deletes the transient file. The persisted file is the CROPPED image — re-cropping after save requires re-uploading (per ADR 0006).
- Thumbnails are generated at upload time for the transient file, regenerated if needed for the persisted file. The existing sharp pipeline is reused.

### Configuration

- AI is configured by a YAML file at `./config/ai.yaml` (mounted as a Docker volume in production).
- File presence = enabled. Missing or unparseable = disabled.
- Config shape: `{ enabled: bool, extra_args: Record<string, string>, api_key: string, url: string, prompt: string }`.
- The prompt supports `${...}` substitutions (e.g. `${image_width}`, `${image_height}`) so the model can be told the original dimensions and return normalized coordinates.
- The same config works for any OpenAI-compatible endpoint (llama.cpp locally, OpenAI, Anthropic, Google, etc.).
- The `extra_args` are passed as additional request parameters (e.g. `slot=0` for llama.cpp slot pinning).
- An `ai.example.yaml` is checked in at `./config/ai.example.yaml` as a starting template; the runtime file is `.gitignore`d.

### AI behavior

- The prompt asks for strict JSON: `{"text": "<ocr or caption>", "bbox": [x_min, y_min, x_max, y_max] | null}`.
- The bbox is normalized 0–1 over the original image dimensions (which are substituted into the prompt at call time so the model knows the coordinate system).
- The model decides per-image whether to OCR (text present) or caption (no text). The same prompt handles both.
- The response is parsed strictly; on parse / schema failure the image is marked `failed` with an error message and a Retry button. One automatic retry is attempted before the row is marked `failed`.
- A `null` bbox means "no specific region is salient" (e.g. a photo of the whole chicken). The user can drag a crop manually.

### Status events

- The AI module emits events to an in-process pub-sub scoped by user (the row's `recorded_by`).
- The SSE endpoint subscribes on connect and streams events as `data: { imageId, status, text?, bbox?, error? }\n\n` chunks.
- Events are best-effort. If the client is disconnected when an event fires, the next `GET` to the image returns the current state and the client reconciles.

## Testing Decisions

What makes a good test:

- Test external behavior — the public API of the module — not internal implementation. The shape of a function's input and output is in scope; the internal bookkeeping is not.
- For the data layer: hit the lib functions directly with a real DB (mirroring the existing `*.integration.test.ts` pattern). The DB seam is `ensureDatabase` + `runMigrations` in `beforeAll`.
- For the AI module: mock the HTTP call to the provider. Verify config loading (presence and parse), prompt substitution, JSON parsing, error handling, retry behavior, and event emission. No DB access in the AI module tests.
- For API routes: light integration tests for auth and request validation where tractable; defer to the lib tests for the rest.

Modules to test:

- `note_images.ts` — full integration tests for: create pending, attach to note, list by note, list pending by chicken, status transitions (pending → processing → succeeded / failed), discard, delete-by-note cascade, and the orphan sweep.
- `ai/` — unit tests for: `loadAIConfig` (missing file, valid file, invalid YAML), `callAIProvider` (mocked HTTP, success and error responses), `parseAIResponse` (valid JSON, invalid JSON, schema mismatch, null bbox, bbox out of range), `processNoteImage` (full lifecycle with mocked provider), retry behavior (one auto-retry, then user-driven), and event emission (callers receive the right events).
- API routes — integration tests for: image upload (auth, size, type, magic bytes), the SSE endpoint (auth, event delivery, user scoping), the discard-batch endpoint, and the note-save extension (imageIds, crop application, transient file deletion).

Prior art:

- `tests/notes.integration.test.ts` — direct-lib integration tests with real DB for the notes module. The new `note_images` tests follow the same shape.
- `tests/photos.integration.test.ts` — same shape for the photos module.
- `tests/chickens.integration.test.ts` — same shape for the chickens module.

## Out of Scope

- Multi-page or multi-paragraph AI processing (single prompt, single response per image).
- AI-generated metadata beyond text + bbox (e.g. tags, suggested date, suggested chicken assignment).
- Storing the AI's prompt or full response history (only the last suggestion is kept, for retry/repro).
- Admin UI for editing the AI prompt (file-based config only).
- Note images appearing in the chicken's photo gallery (intentional separation per ADR 0006).
- Cross-device job pickup (a single in-process job queue; jobs started on device A are visible on device B only if the user keeps the dialog open there).
- AI processing of the note's content text (e.g. auto-summarization, spell-check, translation).
- HEIC, AVIF, or other modern image formats not in the current photo allowlist (jpg, png, gif, webp, bmp).
- Bulk upload (one image at a time per add action).
- Re-cropping already-saved images without re-uploading (the original is discarded on save; a future enhancement could keep it, but that's a separate decision).
- Multi-language prompts or per-locale defaults (the prompt is whatever the operator writes in `ai.yaml`).
- Per-user or per-chicken AI overrides (one prompt per deployment).

## Further Notes

- The on-save cropping is a deliberate trade for storage minimalism and reduced retention of potentially sensitive data outside the cropped region (ADR 0006). A future enhancement could keep the original and re-render crops on demand, but that's a separate decision.
- The in-process pub-sub for SSE is fine for a single-flock app on a single server. If the app ever moves to multiple Node processes, this would need Redis or a similar cross-process pub-sub.
- The configurable prompt is the main lever for evolving AI behavior. The operator can iterate on the prompt without code changes.
- The strict-JSON response contract limits compatible models to VLMs that can reliably produce the shape (Gemma 4 12B, GPT-4o, Claude, etc.). Smaller / older local models may not be supported and would fail the strict parser — which is intentional, because we want a loud failure rather than silently dropping half the response.
- The on-disk layout (`IMAGE_DIR/notes/_pending/` for transient files, `IMAGE_DIR/notes/` for persisted cropped files) is an implementation detail of the storage choice; the lib functions expose paths, not folders.
- A real-world rollout plan might start with AI off (no `ai.yaml`), exercise the manual flow, then add `ai.yaml` to enable AI. The fallback to manual is the "day one" experience and must work without AI being configured.
