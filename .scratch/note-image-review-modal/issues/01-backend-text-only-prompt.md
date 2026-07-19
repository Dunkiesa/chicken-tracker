# 01 — Backend text-only prompt support

**What to build:** The server can accept a cropped image region (not the full image with coordinates) and return AI-generated text using a text-only prompt (no bounding box request). This enables the resend flow where the user adjusts the crop and regenerates AI text with only the cropped region visible to the AI.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Backend endpoint accepts a cropped image region and returns AI-generated text
- [ ] The text-only prompt does not request a bounding box
- [ ] The AI processes only the cropped region (not the full image)
- [ ] The response contains only text (no bbox)
- [ ] Tests verify the endpoint accepts cropped images and returns text-only responses
