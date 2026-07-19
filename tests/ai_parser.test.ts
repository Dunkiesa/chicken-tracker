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
