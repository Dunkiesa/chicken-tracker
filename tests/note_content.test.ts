import { combineNoteContent, parseAiTexts } from "@/lib/note_content";

describe("combineNoteContent", () => {
  it("returns user content unchanged when there are no AI texts", () => {
    expect(combineNoteContent("My note text", [])).toBe("My note text");
  });

  it("returns user content unchanged when AI texts array is empty", () => {
    expect(combineNoteContent("Hello world", [])).toBe("Hello world");
  });

  it("appends a single AI text after user content separated by newlines", () => {
    const result = combineNoteContent("My observation", ["OCR text from image"]);
    expect(result).toBe("My observation\n\nOCR text from image");
  });

  it("appends multiple AI texts in order, separated by newlines", () => {
    const result = combineNoteContent(
      "User content",
      ["First image text", "Second image text", "Third image text"]
    );
    expect(result).toBe(
      "User content\n\nFirst image text\n\nSecond image text\n\nThird image text"
    );
  });

  it("returns only AI texts when user content is empty string", () => {
    const result = combineNoteContent("", ["AI text one", "AI text two"]);
    expect(result).toBe("AI text one\n\nAI text two");
  });

  it("returns only AI texts when user content is whitespace-only", () => {
    const result = combineNoteContent("   ", ["AI text"]);
    expect(result).toBe("AI text");
  });

  it("returns empty string when both user content and AI texts are empty", () => {
    expect(combineNoteContent("", [])).toBe("");
  });

  it("skips null or empty AI texts", () => {
    const result = combineNoteContent("User text", [
      "First",
      null as unknown as string,
      "",
      "Fourth",
    ]);
    expect(result).toBe("User text\n\nFirst\n\nFourth");
  });

  it("preserves user content exactly as provided (no trimming)", () => {
    const result = combineNoteContent("  User text with spaces  ", ["AI"]);
    expect(result).toBe("  User text with spaces  \n\nAI");
  });
});

describe("parseAiTexts", () => {
  it("returns AI texts in the order of imageIds", () => {
    const result = parseAiTexts({ "1": "First", "2": "Second" }, [1, 2]);
    expect(result).toEqual(["First", "Second"]);
  });

  it("returns null for imageIds not present in aiTexts", () => {
    const result = parseAiTexts({ "1": "First" }, [1, 2, 3]);
    expect(result).toEqual(["First", null, null]);
  });

  it("returns empty array when imageIds is empty", () => {
    expect(parseAiTexts({ "1": "First" }, [])).toEqual([]);
  });

  it("handles null/undefined aiTexts gracefully", () => {
    expect(parseAiTexts(null, [1, 2])).toEqual([null, null]);
    expect(parseAiTexts(undefined, [1])).toEqual([null]);
  });

  it("handles non-object aiTexts gracefully", () => {
    expect(parseAiTexts("invalid", [1])).toEqual([null]);
    expect(parseAiTexts(42, [1])).toEqual([null]);
  });
});
