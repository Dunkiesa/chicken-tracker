# 03 — NoteImageReviewModal component

**What to build:** A modal that shows the note image with a crop rectangle (initialized to the AI's suggested bounding box), the AI's suggested text (editable), and Save/Cancel buttons. The crop rectangle and edited text persist in memory until the note is saved. The modal provides a unified review flow for AI results.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Modal opens when triggered (will be wired in a later ticket)
- [ ] Modal shows the image with a free-form crop rectangle
- [ ] Crop rectangle is initialized to the AI's suggested bounding box
- [ ] User can resize the crop rectangle (width and height independently)
- [ ] User can drag the crop rectangle to reposition it
- [ ] Modal shows the AI's suggested text in an editable field
- [ ] Text field is scrollable for long AI text
- [ ] Modal has Save and Cancel buttons
- [ ] Save persists the crop rectangle and edited text to memory (not disk)
- [ ] Cancel discards changes
- [ ] Modal is stacked vertically (image on top ~60% height, text below)
- [ ] Component is separate from the primary photo CropDialog (no code sharing)
- [ ] Tests verify the modal opens with AI results, crop initialization, text editing, and save/cancel behavior
