export type AIResponseErrorCode = "PARSE_FAILED" | "SCHEMA_MISMATCH" | "BBOX_OUT_OF_RANGE";

export type AIResponseParsed = {
  text: string;
  bbox: [number, number, number, number] | null;
};

export class AIResponseError extends Error {
  readonly code: AIResponseErrorCode;
  constructor(code: AIResponseErrorCode, message: string) {
    super(message);
    this.name = "AIResponseError";
    this.code = code;
  }
}

export function parseAIResponse(raw: string): AIResponseParsed {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AIResponseError("PARSE_FAILED", "Response is not valid JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new AIResponseError(
      "SCHEMA_MISMATCH",
      "Response is not a JSON object"
    );
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.text !== "string") {
    throw new AIResponseError(
      "SCHEMA_MISMATCH",
      "Response missing required string field 'text'"
    );
  }

  if (!("bbox" in obj)) {
    throw new AIResponseError(
      "SCHEMA_MISMATCH",
      "Response missing required field 'bbox'"
    );
  }

  if (obj.bbox === null) {
    return { text: obj.text, bbox: null };
  }

  if (!Array.isArray(obj.bbox) || obj.bbox.length !== 4) {
    throw new AIResponseError(
      "SCHEMA_MISMATCH",
      "bbox must be an array of 4 numbers or null"
    );
  }

  const rawBbox = obj.bbox as unknown[];
  for (let i = 0; i < 4; i++) {
    if (typeof rawBbox[i] !== "number") {
      throw new AIResponseError(
        "SCHEMA_MISMATCH",
        `bbox[${i}] is not a number`
      );
    }
  }

  const x_min = rawBbox[0] as number;
  const y_min = rawBbox[1] as number;
  const x_max = rawBbox[2] as number;
  const y_max = rawBbox[3] as number;

  if (
    x_min < 0 || x_min > 1 ||
    y_min < 0 || y_min > 1 ||
    x_max < 0 || x_max > 1 ||
    y_max < 0 || y_max > 1
  ) {
    throw new AIResponseError(
      "BBOX_OUT_OF_RANGE",
      "bbox values must be between 0 and 1"
    );
  }

  return { text: obj.text, bbox: [x_min, y_min, x_max, y_max] };
}
