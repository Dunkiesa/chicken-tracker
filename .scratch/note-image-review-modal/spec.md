# Note Image Review Modal

**Triage label:** `ready-for-agent`

## Problem Statement

When AI processes note images, the user currently sees a small thumbnail with a status badge. The AI's suggested crop and text are shown inline, but the user cannot see the image in detail, cannot easily adjust the crop rectangle in context, and cannot resend with a modified crop to get better AI results. The AI has a tendency to include more text than desired during OCR, and the user needs an easy way to refine the crop region and regenerate the text while still seeing the full image. Additionally, when AI fails, the current flow does not provide a clear path to retry with a different crop.

## Solution

Introduce a modal dialog that appears when the user clicks a note image thumbnail. The modal shows the image larger, the AI's suggested crop as a resizable rectangle, and the AI's suggested text (editable). The user can adjust the crop, resend to the AI (which sends only the cropped region with a text-only prompt), and save the changes. When AI is disabled, the modal provides manual cropping only.

## User Stories

1. As an admin, I want to click a note image thumbnail to open a review modal, so that I can see the image in a larger format and review the AI's suggestions in detail.

2. As an admin, I want the review modal to show the AI's suggested crop as a resizable rectangle overlay on the image, so that I can see exactly what region the AI identified as the region of interest.

3. As an admin, I want to resize the crop rectangle freely (no aspect ratio lock), so that I can adjust the width and height independently to include more or less of the image.

4. As an admin, I want to drag the crop rectangle to reposition it, so that I can shift the region of interest without changing its size.

5. As an admin, I want the review modal to show the AI's suggested text in an editable field, so that I can review and edit the OCR results while still seeing the image in context.

6. As an admin, I want to click a "Resend" button to send the current crop region back to the AI, so that I can regenerate the text with a different crop (e.g. tighter to reduce background noise, or looser to include more context).

7. As an admin, I want the Resend button to send only the cropped region (not the full image), so that the AI is not distracted by content outside the crop.

8. As an admin, I want the Resend to use a text-only prompt (no bounding box request), so that the AI focuses only on extracting text from the cropped region.

9. As an admin, I want the modal to lock (crop rectangle and text field non-interactive) while AI processes the resend, so that I don't accidentally adjust the crop mid-resend and get confused when the AI's new result replaces my in-flight adjustments.

10. As an admin, I want the new AI text to replace the old text unconditionally on resend, so that the flow is simple and predictable (I own the trade-off of losing any edits I made).

11. As an admin, I want to click "Save" in the review modal to persist the crop rectangle and edited text to memory, so that the changes are ready to be saved with the note.

12. As an admin, I want to click "Cancel" in the review modal to discard changes, so that I can abandon the review without affecting the note.

13. As an admin, I want the crop rectangle to persist in memory (not disk) until the note is saved, so that I can review multiple images, adjust crops, and save everything atomically with the note.

14. As an admin, I want the note save to persist the crop rectangle to disk (only the cropped region written, full image discarded), so that the saved note image is compact and contains only the region of interest.

15. As an admin, I want the note save to combine my typed content first, then the AI texts from all note images in upload order (separated by newlines), so that my voice is primary and the AI text is supporting evidence.

16. As an admin, I want the thumbnail click to open the review modal when AI is enabled and results are ready, so that I can review AI suggestions.

17. As an admin, I want the thumbnail click to open a crop dialog (no text, no resend) when AI is disabled, so that I can manually crop the image.

18. As an admin, I want the thumbnail click to be blocked (non-interactive) while AI is processing, so that I wait to see the AI's crop suggestion before manually adjusting.

19. As an admin, I want the thumbnail click to open the review modal in an error state (with a "Resend" button) when AI fails, so that I can retry with a different crop.

20. As an admin, I want to review one note image at a time in the modal, so that the flow is atomic and I don't get confused about which image I'm adjusting.

21. As an admin, I want to close the modal and click another thumbnail to review a different image, so that I can review multiple images sequentially.

22. As an admin, I want the AI texts to be held in memory per image (not merged into the content field during editing), so that when I resend, the system knows exactly which text to replace without parsing the content field.

23. As an admin, I want the "Add image" button to remain available while AI processes in the background, so that I can upload multiple images quickly without waiting for AI between each one.

24. As an admin, I want the review modal to initialize the crop rectangle to the AI's suggested bounding box, so that I can see what the AI identified and adjust from there.

25. As an admin, I want the review modal to show a "Processing..." state while the initial AI processing is happening (before the modal is opened), so that I know the AI is working.

26. As an admin, I want the review modal to show the AI's error message when AI fails, so that I can understand what went wrong before retrying.

27. As an admin, I want the crop rectangle to be free-form (no aspect ratio lock), so that I can crop tall and narrow regions (e.g. a vet's note) or wide regions (e.g. a feed bag label) without being forced into a fixed shape.

28. As an admin, I want the note image crop dialog (AI disabled) to use a separate component from the primary photo crop dialog, so that the two flows remain independent and don't share code.

29. As an admin, I want the review modal to show the image with the crop rectangle overlay, so that I can see both the full image and the region that will be saved.

30. As an admin, I want the review modal to show the text below the image (stacked vertically), so that I can see the crop and the text together on a mobile screen.

31. As an admin, I want the image to take up approximately 60% of the modal height, so that I can see the image in detail while still having room to read and edit the text.

32. As an admin, I want the text area to be scrollable, so that long AI text doesn't overflow the modal.

33. As an admin, I want the Resend button to show a spinner while AI processes the resend, so that I know the resend is in progress.

34. As an admin, I want the review modal to close automatically after I click "Save", so that I can return to the note dialog and continue editing or save the note.

35. As an admin, I want the note image thumbnails to update (status badge changes) when AI processing completes, so that I know when the results are ready to review.

36. As an admin, I want the review modal to be accessible on mobile, so that I can review AI results at the coop.

37. As an admin, I want the review modal to work in both light and dark mode, so that it matches the app's theme.

38. As an admin, I want the review modal to handle multiple images gracefully (one at a time), so that I can review each image's AI results independently.

39. As an admin, I want the AI texts to be appended in upload order (the order images appear in the thumbnail row), so that the combined text is consistent with the visual order.

40. As an admin, I want the note save to combine the text at save time (not during editing), so that the content field remains the user's typed text only, and the AI texts are added as a final step.

## Implementation Decisions

### Components

- **NoteImageReviewModal** — new component for reviewing AI results. Shows the image with a free-form crop rectangle overlay, the AI's suggested text (editable), and a "Resend" button. Opens on thumbnail click when AI is enabled and results are ready (or failed). Locks during resend. Persists crop and text to memory on save.

- **NoteImageCropDialog** — new component for manual cropping when AI is disabled. Shows the image with a free-form crop rectangle. No text, no resend. Opens on thumbnail click when AI is disabled. Persists crop to memory on save.

- **NoteImageManager** — existing component, modified to route thumbnail clicks: opens `NoteImageReviewModal` when AI is enabled and results are ready (or failed), opens `NoteImageCropDialog` when AI is disabled, blocks click when AI is processing.

- **CropDialog** — existing component for primary photo cropping (round, 1:1 aspect ratio). Not modified; remains separate from note image cropping.

### Crop Rectangle

- Free-form (no aspect ratio lock). User resizes width and height independently, drags to reposition.
- Initialized to AI's suggested bounding box when AI results are ready.
- Persists in memory (not disk) until the note is saved.
- On note save, the cropped region is written to disk (only the cropped region, full image discarded).

### Resend Flow

- User adjusts crop rectangle, clicks "Resend".
- Server crops the image to the user's rectangle, sends only the cropped region to the AI.
- Server uses a text-only prompt (no bounding box request).
- AI returns text only.
- New text replaces old text unconditionally (user loses any edits).
- Modal locks during resend (crop rectangle and text field non-interactive).
- Resend button shows a spinner while AI processes.

### Text Handling

- AI text is editable in the review modal.
- Text is held in memory per image (not merged into the content field during editing).
- On resend, the new text replaces the old text (no merge, no history).
- On note save, the system combines user content first, then AI texts from all note images in upload order (separated by newlines).
- The combination happens at save time, so the DB stores a single `content` field with the combined text.

### Thumbnail Click Behavior

- **AI enabled + results ready (succeeded):** Opens `NoteImageReviewModal`.
- **AI enabled + processing (pending/processing):** Thumbnail click blocked (non-interactive). User waits for AI to finish.
- **AI enabled + failed:** Opens `NoteImageReviewModal` in error state (shows error message, "Resend" button).
- **AI disabled:** Opens `NoteImageCropDialog` (manual crop only, no text, no resend).

### Save Semantics

- Modal "Save" persists crop rectangle and edited text to memory (not disk).
- Modal "Cancel" discards changes (crop and text revert to previous state).
- Note save (from parent dialog) persists crop to disk (only cropped region written, full image discarded).
- Note save combines user content + AI texts (user first, then AI texts in upload order).

### Backend

- New endpoint (or modified existing endpoint) to handle resend: accepts cropped image (not full image + coords), uses text-only prompt, returns text only.
- Existing AI orchestrator modified to support two prompts: initial prompt (text + bbox) and resend prompt (text only).

### Component Separation

- No code sharing between primary photo cropping (`CropDialog`) and note image cropping (`NoteImageCropDialog` / `NoteImageReviewModal`).
- The two flows are fundamentally different: primary photo cropping is a simple "pick a round region" flow, while note image review is a "review AI results, adjust crop, resend for text-only AI" flow.

## Testing Decisions

### What Makes a Good Test

- Test external behavior, not implementation details.
- Test the component as a black box: given inputs, does it produce the expected outputs?
- Avoid testing internal state (e.g. React state variables); test what the user sees and can do.

### Modules to Test

1. **NoteImageReviewModal** — test as a black box:
   - Given an image with AI results, does it show the crop rectangle initialized to AI's bbox?
   - Does it show editable text?
   - Does it handle resend (sending cropped region with text-only prompt)?
   - Does it lock during resend?
   - Does it persist crop + text on save?
   - Does it discard changes on cancel?

2. **NoteImageCropDialog** — test:
   - Opens on thumbnail click (when AI disabled).
   - Shows free-form crop rectangle.
   - Persists crop on save.
   - Discards crop on cancel.

3. **NoteImageManager** — test:
   - Routes thumbnail clicks correctly based on AI state (enabled + ready → review modal, enabled + processing → blocked, enabled + failed → review modal in error state, disabled → crop dialog).
   - Updates status badges when AI processing completes.

4. **Backend resend endpoint** — test:
   - Accepts cropped image (not full image + coords).
   - Uses text-only prompt.
   - Returns text only.

5. **Note save logic** — test:
   - Combines user content + AI texts in upload order.
   - Persists crop to disk (only cropped region written).

### Prior Art

- Existing component tests in `tests/components/` (e.g. `NoteImageManager.test.tsx`, `CropDialog.test.tsx`).
- AI integration tests in `tests/ai_*.test.ts` (e.g. `ai_orchestrator.test.ts`, `ai_provider.test.ts`).
- Note image integration tests in `tests/note_images.integration.test.ts`.

## Out of Scope

- **Reordering images** — drag-and-drop to reorder note images is out of scope. Images are processed and displayed in upload order.
- **Keeping old AI text versions** — the system does not maintain a history of AI text versions. On resend, the new text replaces the old text unconditionally.
- **Auto-resend on crop change** — the user must explicitly click "Resend". The system does not automatically resend on every crop adjustment.
- **Syncing modal text to content field during editing** — the modal text is held in memory and not merged into the content field until note save.
- **Code sharing between photo cropping and note image cropping** — the two flows use separate components with no shared code.
- **Multiple images per modal session** — the user reviews one image at a time. To review another image, they close the modal and click another thumbnail.

## Further Notes

- **ADR 0008** documents the two-prompt AI flow (initial prompt asks for text + bbox, resend prompt asks for text only on cropped region).
- **CONTEXT.md** updated with review modal details (free-form crop, resend behavior, text-only prompt).
- **"Note photo"** is a synonym for **"note image"** (glossary says avoid "note photo").
- The review modal is the central UI for reviewing AI results. It provides a unified flow for reviewing crop + text, adjusting the crop, and resending for better results.
- The crop rectangle is free-form (no aspect ratio lock) to match the "region of interest" concept (a vet's note might be tall and narrow, a feed bag label might be wide).
- The resend flow sends only the cropped region to prevent the AI from being distracted by background content outside the crop.
- The modal locks during resend to prevent the user from adjusting the crop mid-resend and getting confused when the AI's new result replaces their in-flight adjustments.
- The AI text is editable in the modal, but the user owns the trade-off: if they edit the text and then resend, their edits are lost.
