import sharp from "sharp";
import { readFile, mkdir, unlink } from "fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "path";
import exifReader from "exif-reader";
import { getImageDirectory } from "./photos";

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
] as const;

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const MAX_FILE_SIZE_BYTES = (() => {
  const envVal = process.env.MAX_IMAGE_SIZE_BYTES;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_MAX_FILE_SIZE_BYTES;
})();

export const THUMBNAIL_WIDTH = 300;
export const THUMBNAIL_HEIGHT = 300;
export const THUMBNAIL_QUALITY = 85;

const VALID_MAGIC_HEADERS: string[] = [
  "ffd8ffe0", // JPEG (JFIF)
  "ffd8ffe1", // JPEG (Exif)
  "ffd8ffe2", // JPEG (ICC)
  "89504e47", // PNG
  "47494638", // GIF87a
  "47494639", // GIF89a
  "52494646", // WEBP (RIFF...WEBP)
  "424d", // BMP
];

export type CropRegion = {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
};

export type ImageDimensions = {
  width: number;
  height: number;
};

export function getNotesImageDirectory(): string {
  return join(getImageDirectory(), "notes");
}

export function getPendingImageDirectory(): string {
  return join(getNotesImageDirectory(), "_pending");
}

function toAbsoluteImagePath(imagePath: string): string {
  if (isAbsolute(imagePath)) return imagePath;
  return resolve(join(getImageDirectory(), imagePath));
}

export function resolveImagePath(imagePath: string): string {
  const baseDir = resolve(getImageDirectory());
  const fullPath = toAbsoluteImagePath(imagePath);
  const rel = relative(baseDir, fullPath);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("Path escapes image directory");
  }
  return fullPath;
}

export function validateImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  const header = buffer.slice(0, 4).toString("hex");
  return VALID_MAGIC_HEADERS.some((h) => header.startsWith(h));
}

export async function readImageDimensions(
  sourcePath: string
): Promise<ImageDimensions> {
  const buffer = await readFile(toAbsoluteImagePath(sourcePath));
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Could not determine image dimensions");
  }
  // EXIF orientations 5-8 indicate the image should be rotated 90/270 degrees,
  // which swaps width and height
  const orientation = metadata.orientation ?? 1;
  const needsSwap = orientation >= 5 && orientation <= 8;
  return {
    width: needsSwap ? metadata.height : metadata.width,
    height: needsSwap ? metadata.width : metadata.height,
  };
}

export async function readExifDateTimeOriginal(
  buffer: Buffer
): Promise<Date | null> {
  try {
    const metadata = await sharp(buffer).metadata();
    if (!metadata.exif) return null;
    let exifBuffer = metadata.exif;
    if (exifBuffer.slice(0, 6).toString("ascii") === "Exif\0\0") {
      exifBuffer = exifBuffer.slice(6);
    }
    const parsed = exifReader(exifBuffer);
    const raw =
      parsed.Photo?.DateTimeOriginal ??
      parsed.Photo?.DateTimeDigitized ??
      parsed.Photo?.DateTime;
    if (!raw) return null;
    if (typeof raw === "string") {
      return parseExifDateTime(raw);
    }
    return raw;
  } catch {
    return null;
  }
}

function parseExifDateTime(value: string): Date | null {
  const match = value.match(
    /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/
  );
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;
  return date;
}

function clampCropRegion(crop: CropRegion): CropRegion {
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
  const x_min = clamp01(crop.x_min);
  const y_min = clamp01(crop.y_min);
  const x_max = Math.max(x_min, clamp01(crop.x_max));
  const y_max = Math.max(y_min, clamp01(crop.y_max));
  return { x_min, y_min, x_max, y_max };
}

export async function applyCrop(
  sourcePath: string,
  destinationPath: string,
  crop: CropRegion,
  originalDimensions: ImageDimensions
): Promise<void> {
  const { width, height } = originalDimensions;
  const safe = clampCropRegion(crop);
  const left = Math.round(safe.x_min * width);
  const top = Math.round(safe.y_min * height);
  const extractWidth = Math.max(1, Math.round((safe.x_max - safe.x_min) * width));
  const extractHeight = Math.max(1, Math.round((safe.y_max - safe.y_min) * height));

  const absSource = toAbsoluteImagePath(sourcePath);
  const absDest = toAbsoluteImagePath(destinationPath);
  await mkdir(dirname(absDest), { recursive: true });
  const buffer = await readFile(absSource);
  await sharp(buffer)
    .rotate()
    .extract({ left, top, width: extractWidth, height: extractHeight })
    .toFile(absDest);
}

export async function generateThumbnail(
  sourcePath: string,
  destinationPath: string
): Promise<void> {
  const absSource = toAbsoluteImagePath(sourcePath);
  const absDest = toAbsoluteImagePath(destinationPath);
  await mkdir(dirname(absDest), { recursive: true });
  const buffer = await readFile(absSource);
  await sharp(buffer)
    .rotate()
    .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, { fit: "cover" })
    .webp({ quality: THUMBNAIL_QUALITY })
    .toFile(absDest);
}

export async function deleteImageFile(relativePath: string): Promise<void> {
  if (!relativePath) return;
  const fullPath = resolveImagePath(relativePath);
  try {
    await unlink(fullPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};

export function shardFilename(filename: string): string {
  const shard = filename.slice(0, 2).toLowerCase();
  return `${shard}/${filename}`;
}

export function shardPhotoFilename(filename: string): string {
  const shard = filename.slice(0, 2).toLowerCase();
  return `photos/${shard}/${filename}`;
}

export function mimeTypeFromPath(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return MIME_MAP[ext] ?? "application/octet-stream";
}
