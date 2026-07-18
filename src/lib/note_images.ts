import sql from "mssql";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { getPool } from "./db";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  applyCrop,
  deleteImageFile,
  generateThumbnail,
  getNotesImageDirectory,
  getPendingImageDirectory,
  readImageDimensions,
  resolveImagePath,
  validateImageMagicBytes,
} from "./image-storage";

export type NoteImageStatus = "pending" | "processing" | "succeeded" | "failed";

export class NoteImageNotPendingError extends Error {
  readonly code: string;
  readonly note_image_id: number;
  constructor(note_image_id: number) {
    super(
      `Note image ${note_image_id} is not pending (already attached to a note)`
    );
    this.name = "NoteImageNotPendingError";
    this.code = "NOTE_IMAGE_NOT_PENDING";
    this.note_image_id = note_image_id;
  }
}

export type NoteImageUploadErrorCode =
  | "FILE_TOO_LARGE"
  | "INVALID_MIME_TYPE"
  | "INVALID_MAGIC_BYTES";

export class NoteImageUploadError extends Error {
  readonly code: NoteImageUploadErrorCode;
  constructor(code: NoteImageUploadErrorCode, message: string) {
    super(message);
    this.name = "NoteImageUploadError";
    this.code = code;
  }
}

export type NoteImageReadErrorCode = "NOT_FOUND" | "INVALID_PATH";

export class NoteImageReadError extends Error {
  readonly code: NoteImageReadErrorCode;
  constructor(code: NoteImageReadErrorCode, message: string) {
    super(message);
    this.name = "NoteImageReadError";
    this.code = code;
  }
}

export type CropRegion = {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
};

export type NoteImage = {
  id: number;
  note_id: number | null;
  chicken_id: number;
  file_path: string;
  thumbnail_path: string | null;
  original_width: number | null;
  original_height: number | null;
  crop_x_min: number | null;
  crop_y_min: number | null;
  crop_x_max: number | null;
  crop_y_max: number | null;
  status: NoteImageStatus;
  ai_suggestion: string | null;
  ai_error: string | null;
  recorded_by: string;
  created_at: string;
};

export type CreatePendingNoteImageInput = {
  chicken_id: number;
  file_path: string;
  original_width: number | null;
  original_height: number | null;
  recorded_by: string;
};

export type AttachNoteImageInput = {
  cropped_file_path: string;
  thumbnail_path?: string;
  crop_x_min: number;
  crop_y_min: number;
  crop_x_max: number;
  crop_y_max: number;
};

export type UpdateNoteImageStatusInput = {
  ai_suggestion?: string | null;
  ai_error?: string | null;
};

export type UpdateNoteImageCropInput = {
  crop_x_min: number;
  crop_y_min: number;
  crop_x_max: number;
  crop_y_max: number;
};

export type CreatePendingNoteImageFromUploadInput = {
  chicken_id: number;
  buffer: Buffer;
  original_filename: string;
  mime_type: string;
  recorded_by: string;
};

export type ReadNoteImageBytesResult = {
  buffer: Buffer;
  content_type: string;
};

function isAllowedMimeType(type: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(type);
}

function extFromFilename(filename: string): string {
  const ext = filename.split(".").pop() ?? "";
  return ext.toLowerCase() || "jpg";
}

const NOTE_IMAGE_SELECT_SQL = `
  SELECT
    ni.id,
    ni.note_id,
    ni.chicken_id,
    ni.file_path,
    ni.thumbnail_path,
    ni.original_width,
    ni.original_height,
    ni.crop_x_min,
    ni.crop_y_min,
    ni.crop_x_max,
    ni.crop_y_max,
    ni.status,
    ni.ai_suggestion,
    ni.ai_error,
    ni.recorded_by,
    CONVERT(varchar, ni.created_at, 20) AS created_at
  FROM note_images ni
`;

function rowToNoteImage(row: Record<string, unknown>): NoteImage {
  return {
    id: row.id as number,
    note_id: (row.note_id as number | null) ?? null,
    chicken_id: row.chicken_id as number,
    file_path: row.file_path as string,
    thumbnail_path: (row.thumbnail_path as string | null) ?? null,
    original_width: (row.original_width as number | null) ?? null,
    original_height: (row.original_height as number | null) ?? null,
    crop_x_min: row.crop_x_min != null ? parseFloat(row.crop_x_min as string) : null,
    crop_y_min: row.crop_y_min != null ? parseFloat(row.crop_y_min as string) : null,
    crop_x_max: row.crop_x_max != null ? parseFloat(row.crop_x_max as string) : null,
    crop_y_max: row.crop_y_max != null ? parseFloat(row.crop_y_max as string) : null,
    status: row.status as NoteImageStatus,
    ai_suggestion: (row.ai_suggestion as string | null) ?? null,
    ai_error: (row.ai_error as string | null) ?? null,
    recorded_by: row.recorded_by as string,
    created_at: row.created_at as string,
  };
}

export async function createPendingNoteImage(
  input: CreatePendingNoteImageInput
): Promise<NoteImage> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("chicken_id", sql.Int, input.chicken_id)
    .input("file_path", sql.NVarChar(500), input.file_path)
    .input("original_width", sql.Int, input.original_width)
    .input("original_height", sql.Int, input.original_height)
    .input("recorded_by", sql.NVarChar(255), input.recorded_by)
    .query(`
      INSERT INTO note_images
        (chicken_id, file_path, original_width, original_height, status, recorded_by)
      OUTPUT INSERTED.id
      VALUES
        (@chicken_id, @file_path, @original_width, @original_height, 'pending', @recorded_by)
    `);

  const id = result.recordset[0].id;
  const row = await getNoteImage(id);
  return row!;
}

export async function attachPendingNoteImageToNote(
  note_image_id: number,
  note_id: number,
  input: AttachNoteImageInput
): Promise<NoteImage | null> {
  const existing = await getNoteImage(note_image_id);
  if (!existing) return null;
  if (existing.note_id !== null) {
    throw new NoteImageNotPendingError(note_image_id);
  }

  const pool = await getPool();
  const request = pool
    .request()
    .input("id", sql.Int, note_image_id)
    .input("note_id", sql.Int, note_id)
    .input("file_path", sql.NVarChar(500), input.cropped_file_path)
    .input("crop_x_min", sql.Decimal(5, 4), input.crop_x_min)
    .input("crop_y_min", sql.Decimal(5, 4), input.crop_y_min)
    .input("crop_x_max", sql.Decimal(5, 4), input.crop_x_max)
    .input("crop_y_max", sql.Decimal(5, 4), input.crop_y_max);

  if (input.thumbnail_path !== undefined) {
    request.input("thumbnail_path", sql.NVarChar(500), input.thumbnail_path);
  }

  const sets = [
    "note_id = @note_id",
    "file_path = @file_path",
    "crop_x_min = @crop_x_min",
    "crop_y_min = @crop_y_min",
    "crop_x_max = @crop_x_max",
    "crop_y_max = @crop_y_max",
    "status = 'succeeded'",
  ];
  if (input.thumbnail_path !== undefined) {
    sets.push("thumbnail_path = @thumbnail_path");
  }

  await request.query(
    `UPDATE note_images SET ${sets.join(", ")} WHERE id = @id`
  );

  if (existing.file_path && existing.file_path !== input.cropped_file_path) {
    await deleteImageFile(existing.file_path);
  }

  return getNoteImage(note_image_id);
}

export async function updateNoteImageStatus(
  note_image_id: number,
  status: NoteImageStatus,
  input: UpdateNoteImageStatusInput = {}
): Promise<NoteImage | null> {
  const pool = await getPool();
  const sets: string[] = ["status = @status"];
  const request = pool
    .request()
    .input("id", sql.Int, note_image_id)
    .input("status", sql.NVarChar(50), status);

  if (input.ai_suggestion !== undefined) {
    sets.push("ai_suggestion = @ai_suggestion");
    request.input("ai_suggestion", sql.NVarChar(sql.MAX), input.ai_suggestion);
  }
  if (input.ai_error !== undefined) {
    sets.push("ai_error = @ai_error");
    request.input("ai_error", sql.NVarChar(sql.MAX), input.ai_error);
  }

  await request.query(
    `UPDATE note_images SET ${sets.join(", ")} WHERE id = @id`
  );
  return getNoteImage(note_image_id);
}

export async function updateNoteImageCrop(
  note_image_id: number,
  input: UpdateNoteImageCropInput
): Promise<NoteImage | null> {
  const pool = await getPool();
  await pool
    .request()
    .input("id", sql.Int, note_image_id)
    .input("crop_x_min", sql.Decimal(5, 4), input.crop_x_min)
    .input("crop_y_min", sql.Decimal(5, 4), input.crop_y_min)
    .input("crop_x_max", sql.Decimal(5, 4), input.crop_x_max)
    .input("crop_y_max", sql.Decimal(5, 4), input.crop_y_max)
    .query(`
      UPDATE note_images SET
        crop_x_min = @crop_x_min,
        crop_y_min = @crop_y_min,
        crop_x_max = @crop_x_max,
        crop_y_max = @crop_y_max
      WHERE id = @id
    `);
  return getNoteImage(note_image_id);
}

export async function getNoteImage(id: number): Promise<NoteImage | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`${NOTE_IMAGE_SELECT_SQL} WHERE ni.id = @id`);
  const row = result.recordset[0];
  return row ? rowToNoteImage(row) : null;
}

export async function listNoteImagesByNote(note_id: number): Promise<NoteImage[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("note_id", sql.Int, note_id)
    .query(
      `${NOTE_IMAGE_SELECT_SQL} WHERE ni.note_id = @note_id ORDER BY ni.created_at ASC, ni.id ASC`
    );
  return result.recordset.map(rowToNoteImage);
}

export async function listPendingNoteImagesByChicken(
  chicken_id: number
): Promise<NoteImage[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("chicken_id", sql.Int, chicken_id)
    .query(
      `${NOTE_IMAGE_SELECT_SQL} WHERE ni.chicken_id = @chicken_id AND ni.note_id IS NULL ORDER BY ni.created_at ASC, ni.id ASC`
    );
  return result.recordset.map(rowToNoteImage);
}

export async function discardNoteImage(note_image_id: number): Promise<boolean> {
  const pool = await getPool();
  const affected = await deleteNoteImageRowsAndUnlink(pool, "id = @id", {
    id: { type: sql.Int, value: note_image_id },
  });
  return affected > 0;
}

export async function deleteNoteImagesForNote(note_id: number): Promise<number> {
  const pool = await getPool();
  return deleteNoteImageRowsAndUnlink(pool, "note_id = @note_id", {
    note_id: { type: sql.Int, value: note_id },
  });
}

export async function sweepOrphanNoteImages(
  olderThanHours = 24
): Promise<number> {
  const pool = await getPool();
  const threshold = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  return deleteNoteImageRowsAndUnlink(
    pool,
    "note_id IS NULL AND created_at < @threshold",
    { threshold: { type: sql.DateTime2, value: threshold } }
  );
}

function extFromPath(imagePath: string): string {
  const ext = imagePath.split(".").pop() ?? "";
  return ext.toLowerCase() || "jpg";
}

export async function finalizeNoteImageForSave(
  note_image_id: number,
  note_id: number,
  crop_override?: CropRegion | null
): Promise<NoteImage | null> {
  const existing = await getNoteImage(note_image_id);
  if (!existing) return null;
  if (existing.note_id !== null) {
    throw new NoteImageNotPendingError(note_image_id);
  }

  const crop: CropRegion =
    crop_override ??
    (existing.crop_x_min != null &&
    existing.crop_y_min != null &&
    existing.crop_x_max != null &&
    existing.crop_y_max != null
      ? {
          x_min: existing.crop_x_min,
          y_min: existing.crop_y_min,
          x_max: existing.crop_x_max,
          y_max: existing.crop_y_max,
        }
      : { x_min: 0, y_min: 0, x_max: 1, y_max: 1 });

  const ext = extFromPath(existing.file_path);
  const persistedFilename = `${randomUUID()}.${ext}`;
  const persistedFilePath = `notes/${persistedFilename}`;
  const persistedThumbFilename = `${randomUUID()}_thumb.webp`;
  const persistedThumbPath = `notes/${persistedThumbFilename}`;

  const transientBaseName = existing.file_path
    .split("/")
    .pop()!
    .replace(/\.[^.]+$/, "");
  const transientThumbPath = `notes/_pending/${transientBaseName}_thumb.webp`;
  await deleteImageFile(transientThumbPath);

  await applyCrop(existing.file_path, persistedFilePath, crop, {
    width: existing.original_width ?? 1,
    height: existing.original_height ?? 1,
  });

  await generateThumbnail(persistedFilePath, persistedThumbPath);

  return attachPendingNoteImageToNote(note_image_id, note_id, {
    cropped_file_path: persistedFilePath,
    thumbnail_path: persistedThumbPath,
    crop_x_min: crop.x_min,
    crop_y_min: crop.y_min,
    crop_x_max: crop.x_max,
    crop_y_max: crop.y_max,
  });
}

export async function discardUnreferencedPendingImages(
  chicken_id: number,
  referenced_image_ids: number[]
): Promise<number> {
  const pending = await listPendingNoteImagesByChicken(chicken_id);
  const refSet = new Set(referenced_image_ids);
  let discarded = 0;
  for (const img of pending) {
    if (!refSet.has(img.id)) {
      const ok = await discardNoteImage(img.id);
      if (ok) discarded++;
    }
  }
  return discarded;
}

export async function deleteNoteImageFilesForChicken(
  chicken_id: number
): Promise<number> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("chicken_id", sql.Int, chicken_id)
    .query(
      `SELECT file_path, thumbnail_path FROM note_images WHERE chicken_id = @chicken_id`
    );

  const paths: string[] = [];
  for (const row of result.recordset) {
    if (row.file_path) paths.push(row.file_path as string);
    if (row.thumbnail_path) paths.push(row.thumbnail_path as string);
  }

  for (const p of paths) {
    await deleteImageFile(p);
  }

  return paths.length;
}

type NoteImageParam = {
  type: (() => sql.ISqlType) | sql.ISqlType;
  value: unknown;
};

async function deleteNoteImageRowsAndUnlink(
  pool: sql.ConnectionPool,
  whereClause: string,
  params: Record<string, NoteImageParam>
): Promise<number> {
  const request = pool.request();
  for (const [name, { type, value }] of Object.entries(params)) {
    request.input(name, type, value);
  }
  const result = await request.query(
    `DELETE FROM note_images
     OUTPUT deleted.file_path AS file_path, deleted.thumbnail_path AS thumbnail_path
     WHERE ${whereClause}`
  );

  for (const row of result.recordset) {
    if (row.file_path) {
      await deleteImageFile(row.file_path as string);
    }
    if (row.thumbnail_path) {
      await deleteImageFile(row.thumbnail_path as string);
    }
  }

  return result.rowsAffected[0]!;
}

const READ_MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
};

const PENDING_SUBDIR = "_pending";

function contentTypeFor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return READ_MIME_TYPES[ext] || "application/octet-stream";
}

export async function createPendingNoteImageFromUpload(
  input: CreatePendingNoteImageFromUploadInput
): Promise<NoteImage> {
  if (!isAllowedMimeType(input.mime_type)) {
    throw new NoteImageUploadError(
      "INVALID_MIME_TYPE",
      `File type ${input.mime_type || "unknown"} is not allowed. Accepted: ${ALLOWED_MIME_TYPES.join(", ")}`
    );
  }
  if (input.buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new NoteImageUploadError(
      "FILE_TOO_LARGE",
      "File size exceeds 10 MB limit"
    );
  }
  if (!validateImageMagicBytes(input.buffer)) {
    throw new NoteImageUploadError(
      "INVALID_MAGIC_BYTES",
      "File content does not match allowed image types"
    );
  }

  const ext = extFromFilename(input.original_filename);
  const filename = `${randomUUID()}.${ext}`;
  const relativeFilePath = `notes/${PENDING_SUBDIR}/${filename}`;
  const absoluteFilePath = resolveImagePath(relativeFilePath);
  const pendingDir = getPendingImageDirectory();

  await mkdir(getNotesImageDirectory(), { recursive: true });
  await mkdir(pendingDir, { recursive: true });
  await writeFile(absoluteFilePath, input.buffer);

  const baseName = filename.replace(/\.[^.]+$/, "");
  const thumbnailFilename = `${baseName}_thumb.webp`;
  const relativeThumbnailPath = `notes/${PENDING_SUBDIR}/${thumbnailFilename}`;
  const absoluteThumbnailPath = resolveImagePath(relativeThumbnailPath);
  await generateThumbnail(relativeFilePath, relativeThumbnailPath);

  const dims = await readImageDimensions(relativeFilePath);

  return createPendingNoteImage({
    chicken_id: input.chicken_id,
    file_path: relativeFilePath,
    original_width: dims.width,
    original_height: dims.height,
    recorded_by: input.recorded_by,
  });
}

function isPathSafeForRead(filename: string): boolean {
  if (filename.length === 0) return false;
  if (filename.includes("..")) return false;
  if (filename.includes("/")) return false;
  if (filename.includes("\\")) return false;
  return true;
}

export async function readNoteImageBytesByFilename(
  filename: string
): Promise<ReadNoteImageBytesResult> {
  if (!isPathSafeForRead(filename)) {
    throw new NoteImageReadError("INVALID_PATH", "Invalid filename");
  }

  const candidates = [
    `notes/${filename}`,
    `notes/${PENDING_SUBDIR}/${filename}`,
  ];

  for (const rel of candidates) {
    let abs: string;
    try {
      abs = resolveImagePath(rel);
    } catch {
      continue;
    }
    try {
      const buffer = await readFile(abs);
      return { buffer, content_type: contentTypeFor(filename) };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw err;
    }
  }

  throw new NoteImageReadError("NOT_FOUND", "Not found");
}
