# 07 — Edge cases (processing, failed)

**What to build:** When AI is processing, thumbnail clicks are blocked (non-interactive) to prevent the user from manually cropping before seeing the AI's suggestion. When AI fails, the NoteImageReviewModal opens in an error state showing the AI's error message and a "Resend" button, allowing the user to retry with a different crop.

**Blocked by:** 03 — NoteImageReviewModal component, 04 — NoteImageManager routing

**Status:** ready-for-agent

- [x] Thumbnail click is blocked when AI status is "pending" or "processing"
- [x] Thumbnail click opens NoteImageReviewModal in error state when AI status is "failed"
- [x] Error state shows the AI's error message
- [x] Error state shows a "Resend" button (same label as success state)
- [x] Resend works from error state (sends cropped region, locks modal, replaces text on success)
- [x] Tests verify the processing state blocks clicks and the failed state opens the modal with error message and resend button
