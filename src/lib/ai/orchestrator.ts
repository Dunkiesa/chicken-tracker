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
  const image = await getNoteImage(note_image_id);
  if (!image) {
    throw new Error(`Note image ${note_image_id} not found`);
  }

  const config = loadAIConfig();
  if (!config || !config.enabled) {
    await updateNoteImageStatus(note_image_id, "succeeded", {
      ai_suggestion: null,
      ai_error: null,
    });
    emitStatusEvent(userEmail, {
      imageId: note_image_id,
      status: "skipped",
    });
    return;
  }

  emitStatusEvent(userEmail, {
    imageId: note_image_id,
    status: "processing",
  });

  await updateNoteImageStatus(note_image_id, "processing");

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await analyzeImageWithAI(image, config);
      await updateNoteImageStatus(note_image_id, "succeeded", {
        ai_suggestion: result.text,
        ai_error: null,
      });
      emitStatusEvent(userEmail, {
        imageId: note_image_id,
        status: "succeeded",
        text: result.text,
        bbox: result.bbox,
      });
      return;
    } catch (err) {
      lastError = err as Error;
    }
  }

  const errorMessage = lastError?.message ?? "Unknown error";
  await updateNoteImageStatus(note_image_id, "failed", {
    ai_error: errorMessage,
  });
  emitStatusEvent(userEmail, {
    imageId: note_image_id,
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

  const prompt = substitutePrompt(config.prompt, {
    image_width: dims.width,
    image_height: dims.height,
  });

  const rawResponse = await callAIProvider(config, base64, mimeType, prompt);
  return parseAIResponse(rawResponse);
}
