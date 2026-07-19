export function combineNoteContent(
  userContent: string,
  aiTexts: (string | null)[]
): string {
  const validTexts = aiTexts.filter(
    (t): t is string => t != null && t.length > 0
  );

  if (validTexts.length === 0) {
    return userContent;
  }

  const userPart = userContent.trim() ? userContent : "";
  const parts = userPart ? [userPart, ...validTexts] : validTexts;
  return parts.join("\n\n");
}

export function parseAiTexts(
  aiTexts: unknown,
  imageIds: number[]
): (string | null)[] {
  const aiTextMap: Record<string, string> =
    aiTexts && typeof aiTexts === "object"
      ? (aiTexts as Record<string, string>)
      : {};
  return imageIds.map((id) => aiTextMap[String(id)] ?? null);
}
