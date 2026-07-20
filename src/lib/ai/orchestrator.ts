import { readFile } from "fs/promises";
import sharp from "sharp";
import { loadAIConfig, substitutePrompt, type AIConfig } from "./config";
import { callAIProvider } from "./provider";
import { parseAIResponse, parseTextOnlyResponse } from "./parser";
import { emitStatusEvent } from "./pubsub";
import { aiLog, aiError } from "./logger";
import {
  getNoteImage,
  updateNoteImageStatus,
  type NoteImage,
  type CropRegion,
} from "../note_images";
import { readImageDimensions, resolveImagePath, mimeTypeFromPath } from "../image-storage";

export async function processNoteImage(
  note_image_id: number,
  userEmail: string
): Promise<void> {
  aiLog(`[AI] processNoteImage started: image_id=${note_image_id}, user=${userEmail}`);

  const image = await getNoteImage(note_image_id);
  if (!image) {
    aiError(`[AI] Note image ${note_image_id} not found`);
    throw new Error(`Note image ${note_image_id} not found`);
  }

  const config = loadAIConfig();
  if (!config || !config.enabled) {
    aiLog(`[AI] AI disabled or no config, skipping image ${note_image_id}`);
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

  aiLog(`[AI] Config loaded: url=${config.url}, extra_args=${JSON.stringify(config.extra_args)}`);

  emitStatusEvent(userEmail, {
    imageId: note_image_id,
    chickenId: image.chicken_id,
    status: "processing",
  });

  await updateNoteImageStatus(note_image_id, "processing");

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      aiLog(`[AI] Attempt ${attempt + 1}/2 for image ${note_image_id}`);
      const result = await analyzeImageWithAI(image, config);
      aiLog(`[AI] Success for image ${note_image_id}: text="${result.text.substring(0, 80)}...", bbox=${JSON.stringify(result.bbox)}`);
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
      aiError(`[AI] Attempt ${attempt + 1}/2 failed for image ${note_image_id}: ${lastError.message}`);
    }
  }

  const errorMessage = lastError?.message ?? "Unknown error";
  aiError(`[AI] All attempts failed for image ${note_image_id}: ${errorMessage}`);
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
  const orientedBuffer = await sharp(fileBuffer).rotate().toBuffer();
  const base64 = orientedBuffer.toString("base64");
  const mimeType = mimeTypeFromPath(image.file_path);

  const dims = await readImageDimensions(image.file_path);
  aiLog(`[AI] Image: path=${image.file_path}, dims=${dims.width}x${dims.height}, mime=${mimeType}, size=${base64.length} chars base64`);

  const prompt = substitutePrompt(config.prompt, {
    image_width: dims.width,
    image_height: dims.height,
  });

  aiLog(`[AI] Calling provider at ${config.url}`);
  const rawResponse = await callAIProvider(config, base64, mimeType, prompt);
  aiLog(`[AI] Raw response (${rawResponse.length} chars): "${rawResponse.substring(0, 200)}"`);
  return parseAIResponse(rawResponse, config.bbox_format);
}

export async function resendNoteImage(
  note_image_id: number,
  crop: CropRegion,
  userEmail: string
): Promise<void> {
  aiLog(`[AI] resendNoteImage started: image_id=${note_image_id}, user=${userEmail}`);

  const image = await getNoteImage(note_image_id);
  if (!image) {
    aiError(`[AI] Note image ${note_image_id} not found`);
    throw new Error(`Note image ${note_image_id} not found`);
  }

  const config = loadAIConfig();
  if (!config || !config.enabled) {
    throw new Error("AI is not enabled");
  }
  if (!config.resend_prompt) {
    throw new Error("resend_prompt is not configured");
  }

  emitStatusEvent(userEmail, {
    imageId: note_image_id,
    chickenId: image.chicken_id,
    status: "processing",
  });

  await updateNoteImageStatus(note_image_id, "processing");

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      aiLog(`[AI] Resend attempt ${attempt + 1}/2 for image ${note_image_id}`);
      const text = await analyzeCroppedRegionWithAI(image, crop, config);
      aiLog(`[AI] Resend success for image ${note_image_id}: text="${text.substring(0, 80)}"`);
      await updateNoteImageStatus(note_image_id, "succeeded", {
        ai_suggestion: text,
        ai_error: null,
      });
      emitStatusEvent(userEmail, {
        imageId: note_image_id,
        chickenId: image.chicken_id,
        status: "succeeded",
        text,
        bbox: null,
      });
      return;
    } catch (err) {
      lastError = err as Error;
      aiError(`[AI] Resend attempt ${attempt + 1}/2 failed for image ${note_image_id}: ${lastError.message}`);
    }
  }

  const errorMessage = lastError?.message ?? "Unknown error";
  aiError(`[AI] All resend attempts failed for image ${note_image_id}: ${errorMessage}`);
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

async function analyzeCroppedRegionWithAI(
  image: NoteImage,
  crop: CropRegion,
  config: AIConfig
): Promise<string> {
  const absPath = resolveImagePath(image.file_path);
  const fileBuffer = await readFile(absPath);
  const dims = await readImageDimensions(image.file_path);

  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
  const xMin = clamp01(crop.x_min);
  const yMin = clamp01(crop.y_min);
  const xMax = Math.max(xMin, clamp01(crop.x_max));
  const yMax = Math.max(yMin, clamp01(crop.y_max));

  const left = Math.round(xMin * dims.width);
  const top = Math.round(yMin * dims.height);
  const extractWidth = Math.max(1, Math.round((xMax - xMin) * dims.width));
  const extractHeight = Math.max(1, Math.round((yMax - yMin) * dims.height));

  const croppedBuffer = await sharp(fileBuffer)
    .rotate()
    .extract({ left, top, width: extractWidth, height: extractHeight })
    .toBuffer();

  const base64 = croppedBuffer.toString("base64");
  const mimeType = mimeTypeFromPath(image.file_path);

  aiLog(`[AI] Cropped region: ${extractWidth}x${extractHeight} from ${dims.width}x${dims.height}, mime=${mimeType}`);

  const rawResponse = await callAIProvider(config, base64, mimeType, config.resend_prompt);
  aiLog(`[AI] Resend raw response (${rawResponse.length} chars): "${rawResponse.substring(0, 200)}"`);
  return parseTextOnlyResponse(rawResponse);
}
