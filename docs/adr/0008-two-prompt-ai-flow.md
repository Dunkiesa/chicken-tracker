# 8. Two-prompt AI flow for note images

- Status: Accepted
- Date: 2026-07-19

## Context

Note images go through AI processing to extract text (OCR) and identify the region of interest (bounding box). The user can adjust the crop and request a new AI result. The question was: what should be sent to the AI on resend — the full image with coordinates, or just the cropped region? And should the prompt change between the initial request and the resend?

## Decision

The AI flow uses **two distinct prompts**:

1. **Initial prompt** — sent when the image is first uploaded. Requests both **text extraction** and a **bounding box** (region of interest). The AI returns the suggested crop rectangle and the OCR text.

2. **Resend prompt** — sent when the user adjusts the crop and clicks "Resend". Requests **text extraction only** (no bounding box). The server crops the image to the user's rectangle and sends only that cropped region to the AI.

On resend, the AI's new text **replaces** the old text unconditionally. The user owns the trade-off: if they edited the text and then resend, their edits are lost.

## Consequences

- **AI sees only what gets saved.** The resend flow sends the cropped region, not the full image. This prevents the AI from being distracted by background content outside the crop (e.g. coop walls, other chickens) and generating irrelevant text.
- **Two prompts, not one.** The initial prompt must ask for a bbox (so the AI can suggest a crop), but the resend prompt must not (the user has already chosen the crop). This requires maintaining two separate prompt templates or conditional logic in the prompt.
- **Text replacement is unconditional.** If the user edits the AI's text and then resends with a different crop, their edits are lost. This is a deliberate trade for simplicity: no merge logic, no "keep both versions" UI. The user can always resend again if the new result is worse.
- **Crop rectangle is free-form.** No aspect-ratio lock — the user can resize width and height independently. This matches the "region of interest" concept (a vet's note might be tall and narrow, a feed bag label might be wide) but means the AI's initial bbox is just a suggestion, not a constraint.
- **Review modal locks during resend.** The crop rectangle and text field are non-interactive while AI processes the resend. This prevents the user from adjusting the crop mid-resend and then being confused when the AI's new result replaces their in-flight adjustments.

## Alternatives considered

- **Send full image + crop coordinates on resend** — the AI sees the full context but is instructed to focus on the specified region. Rejected: the AI might still generate text about content outside the crop, confusing the user when the text doesn't match the cropped image they see. Sending only the cropped region forces the AI to process exactly what gets saved.
- **Keep old text alongside new text** — show both versions and let the user choose. Rejected: adds UI complexity for a case the user can recover from by editing the text themselves or resending again. The glossary already defines "the AI's last-suggested text" (singular), not a history.
- **Auto-resend on crop change** — debounce and resend every time the user adjusts the crop. Rejected: would hammer the AI (and the user would see the text changing as they drag). An explicit "Resend" button makes the intent clear.
