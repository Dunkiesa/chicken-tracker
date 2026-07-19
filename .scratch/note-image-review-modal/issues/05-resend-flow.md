# 05 — Resend flow

**What to build:** The NoteImageReviewModal's "Resend" button sends the cropped region to the backend (using the text-only prompt endpoint), locks the modal during AI processing (crop rectangle and text field non-interactive), and replaces the old text unconditionally when the new result arrives. The user can refine the crop and regenerate AI text with only the cropped region visible to the AI.

**Blocked by:** 01 — Backend text-only prompt support, 03 — NoteImageReviewModal component

**Status:** ready-for-agent

- [ ] Resend button sends the cropped region to the backend text-only prompt endpoint
- [ ] Resend button shows a spinner while AI processes
- [ ] Modal locks during resend (crop rectangle and text field non-interactive)
- [ ] New AI text replaces old text unconditionally when resend completes
- [ ] Modal unlocks after resend completes
- [ ] Tests verify the resend flow: sending cropped region, locking during processing, replacing text, and unlocking
