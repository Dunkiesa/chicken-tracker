import { callAIProvider, AIProviderError } from "@/lib/ai/provider";
import type { AIConfig } from "@/lib/ai/config";

const mockConfig: AIConfig = {
  enabled: true,
  extra_args: { slot: "1" },
  api_key: "test-key",
  url: "http://localhost:8080/v1/chat/completions",
  prompt: "Analyze this image",
  resend_prompt: "Extract text only",
  bbox_format: "json",
};

describe("callAIProvider", () => {
  let fetchSpy: jest.SpyInstance;

  afterEach(() => {
    if (fetchSpy) fetchSpy.mockRestore();
  });

  it("POSTs OpenAI chat-completions shape and returns response text", async () => {
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"text":"hello","bbox":null}' } }],
      }),
      text: async () => "",
    } as Response);

    const result = await callAIProvider(
      mockConfig,
      "base64data",
      "image/jpeg",
      "Analyze this image"
    );

    expect(result).toBe('{"text":"hello","bbox":null}');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, options] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("http://localhost:8080/v1/chat/completions");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers["Authorization"]).toBe("Bearer test-key");

    const body = JSON.parse(options.body);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe("user");
    expect(body.messages[0].content).toHaveLength(2);
    expect(body.messages[0].content[0]).toEqual({
      type: "text",
      text: "Analyze this image",
    });
    expect(body.messages[0].content[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,base64data" },
    });
    expect(body.id_slot).toBe("1");
    expect(body.slot).toBeUndefined();
  });

  it("includes chat_template_kwargs when present in config", async () => {
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"text":"hello","bbox":null}' } }],
      }),
      text: async () => "",
    } as Response);

    const configWithKwargs: AIConfig = {
      ...mockConfig,
      chat_template_kwargs: { enable_thinking: false },
    };

    await callAIProvider(
      configWithKwargs,
      "base64data",
      "image/jpeg",
      "Analyze this image"
    );

    const body = JSON.parse(fetchSpy.mock.calls[0]![1].body);
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false });
  });

  it("omits chat_template_kwargs when not in config", async () => {
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"text":"hello","bbox":null}' } }],
      }),
      text: async () => "",
    } as Response);

    await callAIProvider(
      mockConfig,
      "base64data",
      "image/jpeg",
      "Analyze this image"
    );

    const body = JSON.parse(fetchSpy.mock.calls[0]![1].body);
    expect(body.chat_template_kwargs).toBeUndefined();
  });

  it("throws on non-ok HTTP response", async () => {
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    } as Response);

    try {
      await callAIProvider(mockConfig, "data", "image/png", "prompt");
      fail("Expected AIProviderError");
    } catch (err) {
      expect(err).toBeInstanceOf(AIProviderError);
      expect((err as AIProviderError).code).toBe("HTTP_ERROR");
      expect((err as AIProviderError).message).toContain("500");
    }
  });

  it("throws when response has no choices", async () => {
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] }),
    } as Response);

    try {
      await callAIProvider(mockConfig, "data", "image/png", "prompt");
      fail("Expected AIProviderError");
    } catch (err) {
      expect(err).toBeInstanceOf(AIProviderError);
      expect((err as AIProviderError).code).toBe("NO_CHOICES");
    }
  });

  it("throws when response message has no content", async () => {
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: {} }] }),
    } as Response);

    try {
      await callAIProvider(mockConfig, "data", "image/png", "prompt");
      fail("Expected AIProviderError");
    } catch (err) {
      expect(err).toBeInstanceOf(AIProviderError);
      expect((err as AIProviderError).code).toBe("MISSING_CONTENT");
    }
  });
});
