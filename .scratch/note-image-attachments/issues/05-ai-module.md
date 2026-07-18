**Triage label:** `ready-for-agent`

## What to build

Build the AI module as a self-contained, testable unit. Per ADR 0007: presence of `./config/ai.yaml` means AI is enabled; the file is the on/off signal. Add a `yaml` package dependency for parsing.

The config loader reads `./config/ai.yaml` and returns a typed object `{ enabled: boolean, extra_args: Record<string, string>, api_key: string, url: string, prompt: string }`. Missing file → `null`. Unparseable → `null` and a logged error. A thin `isAIEnabled()` returns `true` iff the config is present and `enabled !== false`. The prompt supports `${...}` substitutions (e.g. `${image_width}`, `${image_height}`); expose a `substitutePrompt(template, vars)` helper that the provider call uses at request time so the model can be told the original image dimensions and return normalized 0–1 coordinates.

The provider call POSTs to `config.url` using the OpenAI chat-completions shape (works for llama.cpp locally and for the major subscription APIs). The image is sent as a base64 data URL in a `image_url` content part of a single user message; the `prompt` is the text part. `extra_args` are merged into the request body alongside the standard fields (e.g. llama.cpp slot pinning). `api_key` is sent as a Bearer token. The function returns the raw response text. Do not parse the response here — that's a separate step.

The response parser validates the strict JSON shape `{"text": string, "bbox": [x_min, y_min, x_max, y_max] | null}`. Throw a typed error (with a stable `code` like `"PARSE_FAILED"` / `"SCHEMA_MISMATCH"` / `"BBOX_OUT_OF_RANGE"`) on JSON parse failure, schema mismatch, wrong types, or bbox values outside [0, 1]. `null` bbox is a valid value (means "no salient region").

The orchestrator `processNoteImage(note_image_id)`: (1) reads the transient image from disk and reads its original dimensions via the helper from slice 1; (2) loads config — if disabled, marks the image with a typed "no AI configured" status and emits the event; (3) calls the provider, parses the response, writes the AI suggestion and bbox onto the row, marks `succeeded`, and emits the event; (4) on any failure (parse / HTTP / schema) does one auto-retry before marking `failed` with the error message; emits events at every state transition. The orchestrator updates the row via the data layer from slice 1; the AI module has no direct DB code.

The pub-sub: an in-process `Map<userEmail, Set<callback>>`. Expose `subscribeToStatusEvents(userEmail, callback)` and `emitStatusEvent(userEmail, payload)`. Payloads are `{ imageId, status, text?, bbox?, error? }`. Single Node process, no Redis, no external queue — ADR 0007 calls this out explicitly.

Add `config/ai.example.yaml` as a checked-in template showing the full schema. Add `./config/ai.yaml` to `.gitignore` (and `.dockerignore` if present) so the runtime file isn't committed.

Unit tests (no DB, no real HTTP) cover: `loadAIConfig` missing file / valid file / invalid YAML; `substitutePrompt` happy + missing-var; `callAIProvider` mocked HTTP success and error; `parseAIResponse` valid JSON, invalid JSON, schema mismatch, null bbox, bbox out of range; `processNoteImage` full lifecycle with mocked provider and mocked data-layer writes; retry behaviour (one auto-retry on parse failure, then `failed`); event emission (callers receive the right events for the right rows).

## Acceptance criteria

- [ ] `loadAIConfig` returns a typed config or `null` (missing / unparseable); `isAIEnabled` is a thin wrapper
- [ ] `callAIProvider` POSTs OpenAI chat-completions shape with the image as a base64 data URL, `extra_args` merged in, `api_key` as Bearer; returns raw response text
- [ ] `parseAIResponse` validates the strict JSON shape; throws typed errors with stable codes for parse / schema / range failures; accepts `null` bbox
- [ ] `processNoteImage` runs the full lifecycle: read image → load config (skip if disabled) → call provider → parse → update row → emit event; one auto-retry on parse failure before going `failed`
- [ ] In-process pub-sub (`subscribeToStatusEvents` / `emitStatusEvent`) keyed by user email; no external queue
- [ ] `config/ai.example.yaml` is checked in as a template; `./config/ai.yaml` is gitignored
- [ ] `yaml` package added as a runtime dependency
- [ ] Unit tests cover everything above with mocked HTTP, mocked data-layer writes, and mocked pub-sub; pass via `npm test`

## Blocked by

- Issue 01 - Data foundation + storage helpers
