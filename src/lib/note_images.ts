import sql from "mssql";
import { getPool } from "./db";
import { deleteImageFile } from "./image-storage";

export type NoteImageStatus = "pending" | "processing" | "succeeded" | "failed";

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
  crop_x_min: number;
  crop_y_min: number;
  crop_x_max: number;
  crop_y_max: number;
};

export type UpdateNoteImageStatusInput = {
  ai_suggestion?: string | null;
  ai_error?: string | null;
};

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
  if (existing.note_id !== null) return existing;

  const pool = await getPool();
  await pool
    .request()
    .input("id", sql.Int, note_image_id)
    .input("note_id", sql.Int, note_id)
    .input("file_path", sql.NVarChar(500), input.cropped_file_path)
    .input("crop_x_min", sql.Decimal(5, 4), input.crop_x_min)
    .input("crop_y_min", sql.Decimal(5, 4), input.crop_y_min)
    .input("crop_x_max", sql.Decimal(5, 4), input.crop_x_max)
    .input("crop_y_max", sql.Decimal(5, 4), input.crop_y_max)
    .query(`
      UPDATE note_images SET
        note_id = @note_id,
        file_path = @file_path,
        crop_x_min = @crop_x_min,
        crop_y_min = @crop_y_min,
        crop_x_max = @crop_x_max,
        crop_y_max = @crop_y_max,
        status = 'succeeded'
      WHERE id = @id
    `);

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
  const existing = await getNoteImage(note_image_id);
  if (!existing) return false;

  if (existing.file_path) {
    await deleteImageFile(existing.file_path);
  }
  if (existing.thumbnail_path) {
    await deleteImageFile(existing.thumbnail_path);
  }

  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.Int, note_image_id)
    .query("DELETE FROM note_images WHERE id = @id");
  return result.rowsAffected[0]! > 0;
}

export async function deleteNoteImagesForNote(note_id: number): Promise<number> {
  const pool = await getPool();
  const images = await listNoteImagesByNote(note_id);
  for (const img of images) {
    if (img.file_path) {
      await deleteImageFile(img.file_path);
    }
    if (img.thumbnail_path) {
      await deleteImageFile(img.thumbnail_path);
    }
  }
  const result = await pool
    .request()
    .input("note_id", sql.Int, note_id)
    .query("DELETE FROM note_images WHERE note_id = @note_id");
  return result.rowsAffected[0]!;
}

export async function sweepOrphanNoteImages(
  olderThanHours = 24
): Promise<number> {
  const pool = await getPool();
  const candidates = await pool
    .request()
    .input("threshold", sql.DateTime2, new Date(Date.now() - olderThanHours * 60 * 60 * 1000))
    .query(
      `SELECT id, file_path, thumbnail_path FROM note_images WHERE note_id IS NULL AND created_at < @threshold`
    );

  for (const row of candidates.recordset) {
    if (row.file_path) {
      await deleteImageFile(row.file_path as string);
    }
    if (row.thumbnail_path) {
      await deleteImageFile(row.thumbnail_path as string);
    }
  }

  const result = await pool
    .request()
    .input("threshold", sql.DateTime2, new Date(Date.now() - olderThanHours * 60 * 60 * 1000))
    .query(
      `DELETE FROM note_images WHERE note_id IS NULL AND created_at < @threshold`
    );
  return result.rowsAffected[0]!;
}
