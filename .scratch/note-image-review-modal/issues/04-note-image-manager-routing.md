# 04 — NoteImageManager routing

**What to build:** The NoteImageManager routes thumbnail clicks to the correct modal based on AI state: when AI is disabled, clicking a thumbnail opens the NoteImageCropDialog; when AI is enabled and results are ready (succeeded), clicking opens the NoteImageReviewModal. The user can now review AI results or manually crop depending on the AI configuration.

**Blocked by:** 02 — NoteImageCropDialog component, 03 — NoteImageReviewModal component

**Status:** ready-for-agent

- [ ] Thumbnail click opens NoteImageCropDialog when AI is disabled
- [ ] Thumbnail click opens NoteImageReviewModal when AI is enabled and status is "succeeded"
- [ ] Thumbnail click is blocked (non-interactive) when AI is processing (status is "pending" or "processing")
- [ ] Status badges update when AI processing completes
- [ ] Tests verify the routing logic for all AI states (disabled, ready, processing)
