import { readFileSync } from "fs";
import { parse as parseYaml } from "yaml";

export type AIConfig = {
  enabled: boolean;
  extra_args: Record<string, string>;
  api_key: string;
  url: string;
  prompt: string;
};

export function loadAIConfig(
  configPath: string = "./config/ai.yaml"
): AIConfig | null {
  let content: string;
  try {
    content = readFileSync(configPath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(content);
  } catch {
    console.error("AI config: failed to parse YAML");
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    console.error("AI config: parsed YAML is not an object");
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  return {
    enabled: obj.enabled !== false,
    extra_args:
      obj.extra_args && typeof obj.extra_args === "object"
        ? (obj.extra_args as Record<string, string>)
        : {},
    api_key: typeof obj.api_key === "string" ? obj.api_key : "",
    url: typeof obj.url === "string" ? obj.url : "",
    prompt: typeof obj.prompt === "string" ? obj.prompt : "",
  };
}

export function isAIEnabled(config: AIConfig | null): boolean {
  return config !== null && config.enabled !== false;
}

export function substitutePrompt(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\$\{(\w+)\}/g, (match, key) => {
    if (key in vars) {
      return String(vars[key]);
    }
    return match;
  });
}
