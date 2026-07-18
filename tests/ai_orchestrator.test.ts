jest.mock("@/lib/note_images", () => ({
  getNoteImage: jest.fn(),
  updateNoteImageStatus: jest.fn(),
}));

jest.mock("@/lib/image-storage", () => ({
  readImageDimensions: jest.fn(),
  resolveImagePath: jest.fn((p: string) => `/images/${p}`),
  mimeTypeFromPath: jest.fn((p: string) => "image/jpeg"),
}));

jest.mock("@/lib/ai/config", () => ({
  loadAIConfig: jest.fn(),
  substitutePrompt: jest.fn(
    (template: string, vars: Record<string, string | number>) =>
      template.replace(/\$\{(\w+)\}/g, (_, k) => String(vars[k] ?? `\${${k}}`))
  ),
}));

jest.mock("@/lib/ai/provider", () => ({
  callAIProvider: jest.fn(),
}));

jest.mock("@/lib/ai/parser", () => ({
  parseAIResponse: jest.fn(),
}));

jest.mock("@/lib/ai/pubsub", () => ({
  emitStatusEvent: jest.fn(),
}));

jest.mock("fs/promises", () => ({
  readFile: jest.fn(),
}));

import { processNoteImage } from "@/lib/ai/orchestrator";
import { getNoteImage, updateNoteImageStatus } from "@/lib/note_images";
import { readImageDimensions, mimeTypeFromPath } from "@/lib/image-storage";
import { loadAIConfig } from "@/lib/ai/config";
import { callAIProvider } from "@/lib/ai/provider";
import { parseAIResponse } from "@/lib/ai/parser";
import { emitStatusEvent } from "@/lib/ai/pubsub";
import { readFile } from "fs/promises";
import type { NoteImage } from "@/lib/note_images";
import type { AIConfig } from "@/lib/ai/config";

const mockGetNoteImage = getNoteImage as jest.MockedFunction<typeof getNoteImage>;
const mockUpdateStatus = updateNoteImageStatus as jest.MockedFunction<typeof updateNoteImageStatus>;
const mockReadDims = readImageDimensions as jest.MockedFunction<typeof readImageDimensions>;
const mockLoadConfig = loadAIConfig as jest.MockedFunction<typeof loadAIConfig>;
const mockCallProvider = callAIProvider as jest.MockedFunction<typeof callAIProvider>;
const mockParseResponse = parseAIResponse as jest.MockedFunction<typeof parseAIResponse>;
const mockEmit = emitStatusEvent as jest.MockedFunction<typeof emitStatusEvent>;
const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;

const baseImage: NoteImage = {
  id: 1,
  note_id: null,
  chicken_id: 1,
  file_path: "notes/_pending/test.jpg",
  thumbnail_path: null,
  original_width: 800,
  original_height: 600,
  crop_x_min: null,
  crop_y_min: null,
  crop_x_max: null,
  crop_y_max: null,
  status: "pending",
  ai_suggestion: null,
  ai_error: null,
  recorded_by: "user@test.com",
  created_at: "2026-01-01 00:00:00",
};

const baseConfig: AIConfig = {
  enabled: true,
  extra_args: {},
  api_key: "key",
  url: "http://localhost:8080",
  prompt: "Image is ${image_width}x${image_height}",
};

describe("processNoteImage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws when image not found", async () => {
    mockGetNoteImage.mockResolvedValue(null);
    await expect(processNoteImage(999, "user@test.com")).rejects.toThrow(
      "Note image 999 not found"
    );
  });

  it("marks skipped when AI is disabled", async () => {
    mockGetNoteImage.mockResolvedValue({ ...baseImage });
    mockLoadConfig.mockReturnValue(null);
    mockUpdateStatus.mockResolvedValue({ ...baseImage, status: "succeeded" });

    await processNoteImage(1, "user@test.com");

    expect(mockUpdateStatus).toHaveBeenCalledWith(1, "succeeded", {
      ai_suggestion: null,
      ai_error: null,
    });
    expect(mockEmit).toHaveBeenCalledWith("user@test.com", {
      imageId: 1,
      status: "skipped",
    });
    expect(mockCallProvider).not.toHaveBeenCalled();
  });

  it("runs full lifecycle on success", async () => {
    mockGetNoteImage.mockResolvedValue({ ...baseImage });
    mockLoadConfig.mockReturnValue({ ...baseConfig, enabled: true });
    mockReadFile.mockResolvedValue(Buffer.from("fake-image-bytes"));
    mockReadDims.mockResolvedValue({ width: 800, height: 600 });
    mockCallProvider.mockResolvedValue('{"text":"hello","bbox":null}');
    mockParseResponse.mockReturnValue({ text: "hello", bbox: null });
    mockUpdateStatus.mockResolvedValue({ ...baseImage });

    await processNoteImage(1, "user@test.com");

    expect(mockEmit).toHaveBeenCalledWith("user@test.com", {
      imageId: 1,
      status: "processing",
    });
    expect(mockUpdateStatus).toHaveBeenCalledWith(1, "processing");
    expect(mockCallProvider).toHaveBeenCalledWith(
      baseConfig,
      expect.any(String),
      "image/jpeg",
      "Image is 800x600"
    );
    expect(mockUpdateStatus).toHaveBeenCalledWith(1, "succeeded", {
      ai_suggestion: "hello",
      ai_error: null,
    });
    expect(mockEmit).toHaveBeenCalledWith("user@test.com", {
      imageId: 1,
      status: "succeeded",
      text: "hello",
      bbox: null,
    });
  });

  it("retries once on failure then succeeds", async () => {
    mockGetNoteImage.mockResolvedValue({ ...baseImage });
    mockLoadConfig.mockReturnValue({ ...baseConfig, enabled: true });
    mockReadFile.mockResolvedValue(Buffer.from("fake"));
    mockReadDims.mockResolvedValue({ width: 100, height: 100 });

    mockCallProvider
      .mockRejectedValueOnce(new Error("provider error"))
      .mockResolvedValueOnce('{"text":"retry","bbox":null}');
    mockParseResponse.mockReturnValue({ text: "retry", bbox: null });
    mockUpdateStatus.mockResolvedValue({ ...baseImage });

    await processNoteImage(1, "user@test.com");

    expect(mockCallProvider).toHaveBeenCalledTimes(2);
    expect(mockUpdateStatus).toHaveBeenCalledWith(1, "succeeded", {
      ai_suggestion: "retry",
      ai_error: null,
    });
    expect(mockEmit).toHaveBeenCalledWith("user@test.com", {
      imageId: 1,
      status: "succeeded",
      text: "retry",
      bbox: null,
    });
  });

  it("marks failed after two attempts", async () => {
    mockGetNoteImage.mockResolvedValue({ ...baseImage });
    mockLoadConfig.mockReturnValue({ ...baseConfig, enabled: true });
    mockReadFile.mockResolvedValue(Buffer.from("fake"));
    mockReadDims.mockResolvedValue({ width: 100, height: 100 });
    mockCallProvider.mockRejectedValue(new Error("provider down"));
    mockUpdateStatus.mockResolvedValue({ ...baseImage });

    await processNoteImage(1, "user@test.com");

    expect(mockCallProvider).toHaveBeenCalledTimes(2);
    expect(mockUpdateStatus).toHaveBeenCalledWith(1, "failed", {
      ai_error: "provider down",
    });
    expect(mockEmit).toHaveBeenCalledWith("user@test.com", {
      imageId: 1,
      status: "failed",
      error: "provider down",
    });
  });

  it("retries on parse failure then fails", async () => {
    mockGetNoteImage.mockResolvedValue({ ...baseImage });
    mockLoadConfig.mockReturnValue({ ...baseConfig, enabled: true });
    mockReadFile.mockResolvedValue(Buffer.from("fake"));
    mockReadDims.mockResolvedValue({ width: 100, height: 100 });
    mockCallProvider.mockResolvedValue("bad json");
    mockParseResponse.mockImplementation(() => {
      throw new Error("PARSE_FAILED");
    });
    mockUpdateStatus.mockResolvedValue({ ...baseImage });

    await processNoteImage(1, "user@test.com");

    expect(mockCallProvider).toHaveBeenCalledTimes(2);
    expect(mockParseResponse).toHaveBeenCalledTimes(2);
    expect(mockUpdateStatus).toHaveBeenCalledWith(1, "failed", {
      ai_error: "PARSE_FAILED",
    });
  });

  it("emits processing event before calling provider", async () => {
    mockGetNoteImage.mockResolvedValue({ ...baseImage });
    mockLoadConfig.mockReturnValue({ ...baseConfig, enabled: true });
    mockReadFile.mockResolvedValue(Buffer.from("fake"));
    mockReadDims.mockResolvedValue({ width: 100, height: 100 });
    mockCallProvider.mockResolvedValue('{"text":"ok","bbox":null}');
    mockParseResponse.mockReturnValue({ text: "ok", bbox: null });
    mockUpdateStatus.mockResolvedValue({ ...baseImage });

    const callOrder: string[] = [];
    mockEmit.mockImplementation((_, payload) => {
      callOrder.push(payload.status);
    });

    await processNoteImage(1, "user@test.com");

    expect(callOrder[0]).toBe("processing");
    expect(callOrder[1]).toBe("succeeded");
  });
});
