import { parseAIResponse, AIResponseError } from "@/lib/ai/parser";

describe("parseAIResponse", () => {
  it("parses valid JSON with bbox", () => {
    const raw = JSON.stringify({
      text: "Hello world",
      bbox: [0.1, 0.2, 0.8, 0.9],
    });
    const result = parseAIResponse(raw);
    expect(result).toEqual({
      text: "Hello world",
      bbox: [0.1, 0.2, 0.8, 0.9],
    });
  });

  it("parses valid JSON with null bbox", () => {
    const raw = JSON.stringify({ text: "Some text", bbox: null });
    const result = parseAIResponse(raw);
    expect(result).toEqual({ text: "Some text", bbox: null });
  });

  it("throws PARSE_FAILED for invalid JSON", () => {
    expect(() => parseAIResponse("not json")).toThrow(AIResponseError);
    try {
      parseAIResponse("not json");
    } catch (err) {
      expect((err as AIResponseError).code).toBe("PARSE_FAILED");
    }
  });

  it("throws SCHEMA_MISMATCH for non-object JSON", () => {
    expect(() => parseAIResponse('"just a string"')).toThrow(AIResponseError);
    try {
      parseAIResponse('"just a string"');
    } catch (err) {
      expect((err as AIResponseError).code).toBe("SCHEMA_MISMATCH");
    }
  });

  it("throws SCHEMA_MISMATCH when text is missing", () => {
    const raw = JSON.stringify({ bbox: [0.1, 0.2, 0.8, 0.9] });
    expect(() => parseAIResponse(raw)).toThrow(AIResponseError);
    try {
      parseAIResponse(raw);
    } catch (err) {
      expect((err as AIResponseError).code).toBe("SCHEMA_MISMATCH");
    }
  });

  it("throws SCHEMA_MISMATCH when text is not a string", () => {
    const raw = JSON.stringify({ text: 42, bbox: null });
    expect(() => parseAIResponse(raw)).toThrow(AIResponseError);
    try {
      parseAIResponse(raw);
    } catch (err) {
      expect((err as AIResponseError).code).toBe("SCHEMA_MISMATCH");
    }
  });

  it("throws SCHEMA_MISMATCH when bbox is missing", () => {
    const raw = JSON.stringify({ text: "hello" });
    expect(() => parseAIResponse(raw)).toThrow(AIResponseError);
    try {
      parseAIResponse(raw);
    } catch (err) {
      expect((err as AIResponseError).code).toBe("SCHEMA_MISMATCH");
    }
  });

  it("throws SCHEMA_MISMATCH when bbox is wrong length", () => {
    const raw = JSON.stringify({ text: "hello", bbox: [0.1, 0.2] });
    expect(() => parseAIResponse(raw)).toThrow(AIResponseError);
    try {
      parseAIResponse(raw);
    } catch (err) {
      expect((err as AIResponseError).code).toBe("SCHEMA_MISMATCH");
    }
  });

  it("throws SCHEMA_MISMATCH when bbox contains non-numbers", () => {
    const raw = JSON.stringify({ text: "hello", bbox: [0.1, "x", 0.8, 0.9] });
    expect(() => parseAIResponse(raw)).toThrow(AIResponseError);
    try {
      parseAIResponse(raw);
    } catch (err) {
      expect((err as AIResponseError).code).toBe("SCHEMA_MISMATCH");
    }
  });

  it("throws BBOX_OUT_OF_RANGE for values outside [0, 1]", () => {
    const raw = JSON.stringify({ text: "hello", bbox: [0.1, 0.2, 1.5, 0.9] });
    expect(() => parseAIResponse(raw)).toThrow(AIResponseError);
    try {
      parseAIResponse(raw);
    } catch (err) {
      expect((err as AIResponseError).code).toBe("BBOX_OUT_OF_RANGE");
    }
  });

  it("throws BBOX_OUT_OF_RANGE for negative values", () => {
    const raw = JSON.stringify({ text: "hello", bbox: [-0.1, 0.2, 0.8, 0.9] });
    expect(() => parseAIResponse(raw)).toThrow(AIResponseError);
    try {
      parseAIResponse(raw);
    } catch (err) {
      expect((err as AIResponseError).code).toBe("BBOX_OUT_OF_RANGE");
    }
  });

  it("accepts bbox at exact boundaries", () => {
    const raw = JSON.stringify({ text: "hello", bbox: [0, 0, 1, 1] });
    const result = parseAIResponse(raw);
    expect(result.bbox).toEqual([0, 0, 1, 1]);
  });

  it("strips ```json markdown fences", () => {
    const raw = '```json\n{\n  "text": "A bird.",\n  "bbox": [0.13, 0.09, 0.63, 0.99]\n}\n```';
    const result = parseAIResponse(raw);
    expect(result).toEqual({
      text: "A bird.",
      bbox: [0.13, 0.09, 0.63, 0.99],
    });
  });

  it("strips plain ``` markdown fences without language tag", () => {
    const raw = '```\n{"text": "hello", "bbox": null}\n```';
    const result = parseAIResponse(raw);
    expect(result).toEqual({ text: "hello", bbox: null });
  });

  it("handles whitespace around fenced JSON", () => {
    const raw = '  \n```json\n{"text": "test", "bbox": [0,0,1,1]}\n```\n  ';
    const result = parseAIResponse(raw);
    expect(result).toEqual({ text: "test", bbox: [0, 0, 1, 1] });
  });
});

describe("parseAIResponse with gemma format", () => {
  it("parses valid box_2d and converts y-first 0-1000 to x-first 0-1", () => {
    const raw = JSON.stringify({
      text: "A chicken",
      box_2d: [200, 100, 800, 600],
    });
    const result = parseAIResponse(raw, "gemma");
    expect(result).toEqual({
      text: "A chicken",
      bbox: [0.1, 0.2, 0.6, 0.8],
    });
  });

  it("parses null box_2d", () => {
    const raw = JSON.stringify({ text: "A caption", box_2d: null });
    const result = parseAIResponse(raw, "gemma");
    expect(result).toEqual({ text: "A caption", bbox: null });
  });

  it("strips markdown fences", () => {
    const raw = '```json\n{"text": "A bird.", "box_2d": [252, 243, 415, 956]}\n```';
    const result = parseAIResponse(raw, "gemma");
    expect(result).toEqual({
      text: "A bird.",
      bbox: [0.243, 0.252, 0.956, 0.415],
    });
  });

  it("accepts box_2d at exact 0-1000 boundaries", () => {
    const raw = JSON.stringify({ text: "full", box_2d: [0, 0, 1000, 1000] });
    const result = parseAIResponse(raw, "gemma");
    expect(result.bbox).toEqual([0, 0, 1, 1]);
  });

  it("throws PARSE_FAILED for invalid JSON", () => {
    expect(() => parseAIResponse("not json", "gemma")).toThrow(AIResponseError);
    try {
      parseAIResponse("not json", "gemma");
    } catch (err) {
      expect((err as AIResponseError).code).toBe("PARSE_FAILED");
    }
  });

  it("throws SCHEMA_MISMATCH when text is missing", () => {
    const raw = JSON.stringify({ box_2d: [100, 100, 500, 500] });
    expect(() => parseAIResponse(raw, "gemma")).toThrow(AIResponseError);
    try {
      parseAIResponse(raw, "gemma");
    } catch (err) {
      expect((err as AIResponseError).code).toBe("SCHEMA_MISMATCH");
    }
  });

  it("throws SCHEMA_MISMATCH when box_2d is missing", () => {
    const raw = JSON.stringify({ text: "hello" });
    expect(() => parseAIResponse(raw, "gemma")).toThrow(AIResponseError);
    try {
      parseAIResponse(raw, "gemma");
    } catch (err) {
      expect((err as AIResponseError).code).toBe("SCHEMA_MISMATCH");
    }
  });

  it("throws SCHEMA_MISMATCH when box_2d is wrong length", () => {
    const raw = JSON.stringify({ text: "hello", box_2d: [100, 200] });
    expect(() => parseAIResponse(raw, "gemma")).toThrow(AIResponseError);
    try {
      parseAIResponse(raw, "gemma");
    } catch (err) {
      expect((err as AIResponseError).code).toBe("SCHEMA_MISMATCH");
    }
  });

  it("throws SCHEMA_MISMATCH when box_2d contains non-numbers", () => {
    const raw = JSON.stringify({ text: "hello", box_2d: [100, "x", 500, 600] });
    expect(() => parseAIResponse(raw, "gemma")).toThrow(AIResponseError);
    try {
      parseAIResponse(raw, "gemma");
    } catch (err) {
      expect((err as AIResponseError).code).toBe("SCHEMA_MISMATCH");
    }
  });

  it("throws BBOX_OUT_OF_RANGE for values above 1000", () => {
    const raw = JSON.stringify({ text: "hello", box_2d: [100, 100, 1500, 500] });
    expect(() => parseAIResponse(raw, "gemma")).toThrow(AIResponseError);
    try {
      parseAIResponse(raw, "gemma");
    } catch (err) {
      expect((err as AIResponseError).code).toBe("BBOX_OUT_OF_RANGE");
    }
  });

  it("throws BBOX_OUT_OF_RANGE for negative values", () => {
    const raw = JSON.stringify({ text: "hello", box_2d: [-10, 100, 500, 600] });
    expect(() => parseAIResponse(raw, "gemma")).toThrow(AIResponseError);
    try {
      parseAIResponse(raw, "gemma");
    } catch (err) {
      expect((err as AIResponseError).code).toBe("BBOX_OUT_OF_RANGE");
    }
  });

  it("correctly swaps y-first to x-first ordering", () => {
    const raw = JSON.stringify({ text: "test", box_2d: [300, 100, 700, 500] });
    const result = parseAIResponse(raw, "gemma");
    expect(result.bbox).toEqual([0.1, 0.3, 0.5, 0.7]);
  });
});
