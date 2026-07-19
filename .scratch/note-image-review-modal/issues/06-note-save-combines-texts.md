# 06 — Note save combines user content + AI texts

**What to build:** When the user saves a note, the system combines the user's typed content first, then appends AI texts from all note images in upload order (separated by newlines). The combined text is stored in the database as a single content field. The AI texts are held in memory per image (not merged into the content field during editing) and combined only at save time.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Note save combines user content + AI texts from all note images
- [ ] User content appears first, followed by AI texts in upload order
- [ ] AI texts are separated by newlines
- [ ] The combined text is stored in the database as a single content field
- [ ] AI texts are held in memory per image (not merged into content field during editing)
- [ ] The combination happens at save time, not during editing
- [ ] Tests verify the combination logic and database storage
