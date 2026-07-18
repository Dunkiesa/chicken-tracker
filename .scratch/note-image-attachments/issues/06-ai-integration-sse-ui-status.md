**Triage label:** `ready-for-agent`

## What to build

Wire the AI module into the upload path and the dialog so the user sees real-time status, AI-suggested text and crop, and a retry path on failure. The "day one" manual experience (slice 4) is unaffected — when no `ai.yaml` is present, the AI module emits a "no AI configured" event and the UI just shows a "ready" badge (or nothing different) so behaviour is identical to slice 4.

The upload route (slice 2) is extended to fire-and-forget `processNoteImage(note_image_id)` after inserting the pending row. The fire-and-forget is an `await processNoteImage(...).catch(...)` *without* `await` in the request handler — the upload response returns immediately with the row, and the AI work runs in the background. Do not surface AI errors to the upload response.

The SSE endpoint subscribes to the pub-sub from slice 5. `GET /api/chickens/[id]/notes/images/events` returns `Content-Type: text/event-stream` and streams events as `data: { imageId, status, text?, bbox?, error? }\n\n` chunks. It must require NextAuth, scope events to the session user's email, and clean up the subscription on disconnect. The chicken id is part of the URL for consistency with the rest of the surface; the SSE handler filters events to those whose image's `recorded_by` matches the session and whose `chicken_id` matches the URL.

The dialog subscribes to the SSE channel via `EventSource` (per ADR 0007, one-way server-push is the right shape). It must auto-reconnect and, on reconnect, hit the single-image GET endpoint to reconcile state — so a stale "Processing..." badge doesn't persist after the SSE channel drops (story 47). The subscription is scoped to the authenticated user's own actions (story 46).

UI: each image in the Add/Edit dialog shows a status badge that updates in real time — "Processing..." while the row is in `processing`, "AI suggested" on `succeeded`, "Failed" on `failed`. On `succeeded`, the AI's text suggestion is appended to the content field with visual separation (a distinct background or border on the appended portion) per story 22, and the AI's bbox populates the crop overlay so the user can fine-tune (story 15). On `failed`, a Retry button calls a `PATCH .../retry` action (extend the existing PATCH route, or add a sibling) which re-runs `processNoteImage` for that row. Save is disabled while any image is in `processing`; `failed` does not block save (story 21). Per-image `pending` (just uploaded, AI not started yet) does not block save either, but it would be a bug if it stayed that long — the UI can still show a warning if any image has been `pending` for more than a few seconds.

Integration tests cover: the upload route's fire-and-forget (the response returns before the AI work completes, given a slow mocked provider); the SSE endpoint's auth, user scoping, and event delivery (a fake emitter fires events; the SSE client receives them); the reconcile-on-reconnect behaviour (a GET after an SSE drop returns the current state).

Component tests cover: the per-image status badge transitions; the "AI suggested" path appends text to the content field with visual separation; the Retry button calls the right route and the badge updates; the Save button is disabled while any image is `processing`.

## Acceptance criteria

- [ ] Upload route fires-and-forgets `processNoteImage`; the response returns immediately with the `pending` row
- [ ] SSE endpoint streams `data:` chunks, requires NextAuth, scopes events to the session user's email, cleans up on disconnect
- [ ] Dialog opens an `EventSource` to the SSE endpoint, auto-reconnects, and reconciles via GET on reconnect
- [ ] Per-image status badge transitions in real time: Processing → AI suggested / Failed
- [ ] On success, the AI's text is appended to the content field with visual separation; the AI's bbox populates the crop overlay
- [ ] On failure, a Retry button re-runs the AI for that row
- [ ] Save is disabled while any image is `processing`; `failed` does not block save
- [ ] Integration tests cover upload fire-and-forget, SSE auth/scoping/delivery, and reconcile-on-reconnect
- [ ] Component tests cover the status badge transitions, AI-suggested text append + visual separation, Retry, and Save-disabled-while-processing

## Blocked by

- Issue 04 - Manual UI end-to-end
- Issue 05 - AI module
