import type { AIConfig } from "./config";
import { aiLog, aiError } from "./logger";

export type AIProviderErrorCode = "HTTP_ERROR" | "NO_CHOICES" | "MISSING_CONTENT";

export class AIProviderError extends Error {
  readonly code: AIProviderErrorCode;
  constructor(code: AIProviderErrorCode, message: string) {
    super(message);
    this.name = "AIProviderError";
    this.code = code;
  }
}

export async function callAIProvider(
  config: AIConfig,
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const body: Record<string, unknown> = {
    messages: [
      {
        role: "system",
        content: prompt,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
            },
          },
        ],
      },
    ],
  };

  for (const [key, value] of Object.entries(config.extra_args)) {
    body[key === "slot" ? "id_slot" : key] = value;
  }

  if (config.chat_template_kwargs) {
    body.chat_template_kwargs = config.chat_template_kwargs;
  }

  aiLog(`[AI] POST ${config.url} (body keys: ${Object.keys(body).join(", ")})`);
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.api_key}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    aiError(`[AI] Provider returned ${response.status}: ${text}`);
    throw new AIProviderError(
      "HTTP_ERROR",
      `AI provider returned ${response.status}: ${text}`
    );
  }

  aiLog(`[AI] Provider returned 200 OK`);

  const json = (await response.json()) as Record<string, unknown>;
  const choices = json.choices as Array<Record<string, unknown>> | undefined;
  if (!choices || choices.length === 0) {
    throw new AIProviderError("NO_CHOICES", "AI provider returned no choices");
  }

  const first = choices[0];
  const message = first?.message as Record<string, unknown> | undefined;
  if (!message || typeof message.content !== "string") {
    throw new AIProviderError(
      "MISSING_CONTENT",
      "AI provider response missing message content"
    );
  }

  return message.content;
}
