import { loadAIConfig, isAIEnabled, substitutePrompt } from "@/lib/ai/config";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("loadAIConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `ai-config-test-${Date.now()}-${Math.random()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns null when file does not exist", () => {
    const result = loadAIConfig(join(tempDir, "nonexistent.yaml"));
    expect(result).toBeNull();
  });

  it("returns typed config for valid YAML", () => {
    const yaml = [
      "enabled: true",
      "api_key: test-key",
      "url: http://localhost:8080/v1/chat/completions",
      "extra_args:",
      "  slot: '1'",
      "prompt: 'Hello ${image_width}x${image_height}'",
    ].join("\n");
    const filePath = join(tempDir, "ai.yaml");
    writeFileSync(filePath, yaml, "utf-8");

    const result = loadAIConfig(filePath);
    expect(result).toEqual({
      enabled: true,
      extra_args: { slot: "1" },
      api_key: "test-key",
      url: "http://localhost:8080/v1/chat/completions",
      prompt: "Hello ${image_width}x${image_height}",
      bbox_format: "json",
    });
  });

  it("returns null for unparseable YAML", () => {
    const filePath = join(tempDir, "bad.yaml");
    writeFileSync(filePath, "{{{{invalid yaml::::", "utf-8");

    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const result = loadAIConfig(filePath);
    expect(result).toBeNull();
    spy.mockRestore();
  });

  it("defaults enabled to true when not specified", () => {
    const yaml = [
      "api_key: key",
      "url: http://localhost:8080",
      "prompt: test",
    ].join("\n");
    const filePath = join(tempDir, "ai.yaml");
    writeFileSync(filePath, yaml, "utf-8");

    const result = loadAIConfig(filePath);
    expect(result).not.toBeNull();
    expect(result!.enabled).toBe(true);
  });

  it("returns enabled false when explicitly set", () => {
    const yaml = [
      "enabled: false",
      "api_key: key",
      "url: http://localhost:8080",
      "prompt: test",
    ].join("\n");
    const filePath = join(tempDir, "ai.yaml");
    writeFileSync(filePath, yaml, "utf-8");

    const result = loadAIConfig(filePath);
    expect(result).not.toBeNull();
    expect(result!.enabled).toBe(false);
  });

  it("defaults bbox_format to json when not specified", () => {
    const yaml = [
      "api_key: key",
      "url: http://localhost:8080",
      "prompt: test",
    ].join("\n");
    const filePath = join(tempDir, "ai.yaml");
    writeFileSync(filePath, yaml, "utf-8");

    const result = loadAIConfig(filePath);
    expect(result).not.toBeNull();
    expect(result!.bbox_format).toBe("json");
  });

  it("reads bbox_format as gemma when specified", () => {
    const yaml = [
      "api_key: key",
      "url: http://localhost:8080",
      "prompt: test",
      "bbox_format: gemma",
    ].join("\n");
    const filePath = join(tempDir, "ai.yaml");
    writeFileSync(filePath, yaml, "utf-8");

    const result = loadAIConfig(filePath);
    expect(result).not.toBeNull();
    expect(result!.bbox_format).toBe("gemma");
  });

  it("falls back to json for invalid bbox_format", () => {
    const yaml = [
      "api_key: key",
      "url: http://localhost:8080",
      "prompt: test",
      "bbox_format: invalid_format",
    ].join("\n");
    const filePath = join(tempDir, "ai.yaml");
    writeFileSync(filePath, yaml, "utf-8");

    const result = loadAIConfig(filePath);
    expect(result).not.toBeNull();
    expect(result!.bbox_format).toBe("json");
  });
});

describe("isAIEnabled", () => {
  it("returns false for null config", () => {
    expect(isAIEnabled(null)).toBe(false);
  });

  it("returns true when enabled is true", () => {
    expect(
      isAIEnabled({
        enabled: true,
        extra_args: {},
        api_key: "",
        url: "",
        prompt: "",
        bbox_format: "json",
      })
    ).toBe(true);
  });

  it("returns false when enabled is false", () => {
    expect(
      isAIEnabled({
        enabled: false,
        extra_args: {},
        api_key: "",
        url: "",
        prompt: "",
        bbox_format: "json",
      })
    ).toBe(false);
  });
});

describe("substitutePrompt", () => {
  it("replaces known variables", () => {
    const result = substitutePrompt(
      "Image is ${image_width}x${image_height}",
      { image_width: 1920, image_height: 1080 }
    );
    expect(result).toBe("Image is 1920x1080");
  });

  it("leaves unknown variables intact", () => {
    const result = substitutePrompt("Hello ${unknown_var}", {});
    expect(result).toBe("Hello ${unknown_var}");
  });

  it("handles multiple occurrences", () => {
    const result = substitutePrompt("${a} and ${a}", { a: "x" });
    expect(result).toBe("x and x");
  });

  it("handles string values", () => {
    const result = substitutePrompt("Name: ${name}", { name: "test" });
    expect(result).toBe("Name: test");
  });
});
