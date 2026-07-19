import { readFile } from "fs/promises";
import { loadAIConfig, substitutePrompt, type AIConfig } from "./config";
import { callAIProvider } from "./provider";
import { parseAIResponse } from "./parser";
import { emitStatusEvent } from "./pubsub";
import {
  getNoteImage,
  updateNoteImageStatus,
  type NoteImage,
} from "../note_images";
import { readImageDimensions, resolveImagePath, mimeTypeFromPath } from "../image-storage";

export async function processNoteImage(
  note_image_id: number,
  userEmail: string
): Promise<void> {
  console.log(`[AI] processNoteImage started: image_id=${note_image_id}, user=${userEmail}`);

  const image = await getNoteImage(note_image_id);
  if (!image) {
    console.error(`[AI] Note image ${note_image_id} not found`);
    throw new Error(`Note image ${note_image_id} not found`);
  }

  const config = loadAIConfig();
  if (!config || !config.enabled) {
    console.log(`[AI] AI disabled or no config, skipping image ${note_image_id}`);
    await updateNoteImageStatus(note_image_id, "succeeded", {
      ai_suggestion: null,
      ai_error: null,
    });
    emitStatusEvent(userEmail, {
      imageId: note_image_id,
      chickenId: image.chicken_id,
      status: "skipped",
    });
    return;
  }

  console.log(`[AI] Config loaded: url=${config.url}, extra_args=${JSON.stringify(config.extra_args)}`);

  emitStatusEvent(userEmail, {
    imageId: note_image_id,
    chickenId: image.chicken_id,
    status: "processing",
  });

  await updateNoteImageStatus(note_image_id, "processing");

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      console.log(`[AI] Attempt ${attempt + 1}/2 for image ${note_image_id}`);
      const result = await analyzeImageWithAI(image, config);
      console.log(`[AI] Success for image ${note_image_id}: text="${result.text.substring(0, 80)}...", bbox=${JSON.stringify(result.bbox)}`);
      await updateNoteImageStatus(note_image_id, "succeeded", {
        ai_suggestion: result.text,
        ai_error: null,
      });
      emitStatusEvent(userEmail, {
        imageId: note_image_id,
        chickenId: image.chicken_id,
        status: "succeeded",
        text: result.text,
        bbox: result.bbox,
      });
      return;
    } catch (err) {
      lastError = err as Error;
      console.error(`[AI] Attempt ${attempt + 1}/2 failed for image ${note_image_id}: ${lastError.message}`);
    }
  }

  const errorMessage = lastError?.message ?? "Unknown error";
  console.error(`[AI] All attempts failed for image ${note_image_id}: ${errorMessage}`);
  await updateNoteImageStatus(note_image_id, "failed", {
    ai_error: errorMessage,
  });
  emitStatusEvent(userEmail, {
    imageId: note_image_id,
    chickenId: image.chicken_id,
    status: "failed",
    error: errorMessage,
  });
}

async function analyzeImageWithAI(
  image: NoteImage,
  config: AIConfig
): Promise<{ text: string; bbox: [number, number, number, number] | null }> {
  const absPath = resolveImagePath(image.file_path);
  const fileBuffer = await readFile(absPath);
  const base64 = fileBuffer.toString("base64");
  const mimeType = mimeTypeFromPath(image.file_path);

  const dims = await readImageDimensions(image.file_path);
  console.log(`[AI] Image: path=${image.file_path}, dims=${dims.width}x${dims.height}, mime=${mimeType}, size=${base64.length} chars base64`);

  const prompt = substitutePrompt(config.prompt, {
    image_width: dims.width,
    image_height: dims.height,
  });

  console.log(`[AI] Calling provider at ${config.url}`);
  const rawResponse = await callAIProvider(config, base64, mimeType, prompt);
  console.log(`[AI] Raw response (${rawResponse.length} chars): "${rawResponse.substring(0, 200)}"`);
  return parseAIResponse(rawResponse, config.bbox_format);
}
