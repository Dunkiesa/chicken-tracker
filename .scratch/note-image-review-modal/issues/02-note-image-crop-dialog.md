# 02 — NoteImageCropDialog component

**What to build:** A rectangular, free-form crop dialog for note images. When AI is disabled, the user can click a note image thumbnail to open this dialog, manually crop the image with a resizable rectangle (no aspect ratio lock), and save the crop to memory. The crop persists until the note is saved.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Dialog opens on thumbnail click when AI is disabled
- [ ] Dialog shows the image with a free-form crop rectangle (no aspect ratio lock)
- [ ] User can resize the crop rectangle (width and height independently)
- [ ] User can drag the crop rectangle to reposition it
- [ ] Dialog has Save and Cancel buttons
- [ ] Save persists the crop rectangle to memory (not disk)
- [ ] Cancel discards changes
- [ ] Component is separate from the primary photo CropDialog (no code sharing)
- [ ] Tests verify the dialog opens, crop interaction works, and save/cancel behave correctly
