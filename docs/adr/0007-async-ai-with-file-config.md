# 7. Async AI processing with file-based config (presence = enabled)

- Status: Accepted
- Date: 2026-07-18

## Context

The note-image feature needs an AI assist: the model suggests text (OCR or caption) and a crop bounding box for each uploaded image. Local inference on a vision-language model (Gemma 4 12B on llama.cpp) can take 10–30s per image; subscription APIs are usually faster but still non-trivial. The user is expected to add several images per note. AI is also optional — the feature must work without an AI provider, falling back to manual text entry and manual crop. Configuration of the AI is per-deployment (a single-flock app), not per-user.

## Decision

**Async upload + background AI + SSE for status.** The client uploads an image, the server returns immediately with a `note_image` in `pending` state and a background job processes it. Status is pushed to the client over Server-Sent Events scoped to the authenticated user. **Save is blocked until all images reach a terminal state** (succeeded or failed); failed images expose a "Retry" button that re-runs the same prompt against the same image.

**File-based config, presence = enabled.** AI is configured by a per-deployment YAML file at `./config/ai.yaml`. If the file does not exist (or fails to parse), AI is implicitly disabled and the UI degrades to manual mode. When present, the file carries `enabled`, `extra_args` (e.g. llama.cpp slot pinning), `api_key`, `url` (any OpenAI-compatible endpoint — works for llama.cpp locally and paid APIs), and a multi-line `prompt` supporting `${...}` substitutions (e.g. image dimensions injected at call time so the model can return normalized 0–1 coordinates).

**Strict JSON response contract.** The prompt asks the model for `{"text": "<ocr or caption>", "bbox": [x_min, y_min, x_max, y_max] | null}`. We parse the response as JSON; if it fails or the schema is wrong, we mark the image as `failed` with a "Retry" button (one auto-retry, then user-driven). The bbox is normalized 0–1 over the image; `null` means "no specific salient region" and the user can crop manually.

**Orphan cleanup.** Pending images are explicitly discarded by the client when the user cancels the dialog. A periodic server sweep reaps any `note_images` where `note_id IS NULL AND created_at < now() - interval 24 hour` as a safety net for crashed clients.

## Consequences

- The user can keep working in the Add/Edit Note dialog while AI runs in the background (add more images, edit text, adjust crops). The Save button is disabled until every image is resolved.
- SSE is one-way (server → client) and HTTP-based — exactly the shape of "status push" and no upgrade ceremony.
- The background job is in-process for v1 (no Redis, no external queue). This is fine for a single-flock app where the Add/Edit dialog is on a single device at a time. Cross-device job pickup is not supported; if the user closes the dialog on device A and opens it on device B before the AI returns, the result appears on B via SSE on a fresh subscription.
- The prompt is per-deployment, shared by all users on a deployment. There is no admin UI for editing the prompt — to change it, edit `./config/ai.yaml`. The file is mounted as a Docker volume in production.
- The full image is held transiently during edit (see ADR 0006). Background AI jobs read the transient full image; on save (which only happens once all images are terminal) the cropped region is what gets persisted.
- Pending images need cleanup; the explicit-on-cancel + periodic-sweep combination handles both the happy path and crashed clients.
- The model chosen (Gemma 4 12B) constrains the response contract — only VLMs that can reliably produce the JSON shape are supported. Smaller / older local models may fall over and require a "Retry" or a prompt tweak.

## Alternatives considered

- **Sync upload + AI in the request** — simpler, no background jobs, no SSE. But blocks the user for 10–30s per image; with multiple images the dialog becomes unusable. Rejected.
- **On-demand "Get AI suggestion" button** — simplest, no automatic processing. Contradicts the "automatic" framing of the feature. Rejected.
- **Admin UI for the prompt** — more ergonomic, but a full settings page + DB table for one text field. The file-based config satisfies the "customisable" requirement with a much smaller surface. Rejected for v1.
- **`.env` for the prompt** — keeps everything in env vars. Awkward for multi-line strings (JSON `\n` escaping) and requires a container restart to change. Rejected.
- **Polling instead of SSE** — works through any reverse proxy without SSE support, but adds load and latency. SSE is widely supported by reverse proxies the user already runs and is the natural fit for one-way status push. Rejected in favor of SSE.
