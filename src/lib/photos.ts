import sql from "mssql";
import { getPool } from "./db";

export type Photo = {
  id: number;
  chicken_id: number;
  file_path: string;
  thumbnail_path: string | null;
  description: string | null;
  recorded_by: string;
  created_at: string;
};

export type CreatePhotoInput = {
  chicken_id: number;
  file_path: string;
  description?: string;
  recorded_by: string;
};

export type UpdatePhotoInput = {
  description?: string | null;
};

const PHOTO_SELECT_SQL = `
  SELECT
    p.id, p.chicken_id, p.file_path, p.thumbnail_path, p.description, p.recorded_by,
    CONVERT(varchar, p.created_at, 20) AS created_at
  FROM photos p
`;

export async function createPhoto(input: CreatePhotoInput): Promise<Photo> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("chicken_id", sql.Int, input.chicken_id)
    .input("file_path", sql.NVarChar(500), input.file_path)
    .input("description", sql.NVarChar(1000), input.description ?? null)
    .input("recorded_by", sql.NVarChar(255), input.recorded_by)
    .query(`
      INSERT INTO photos (chicken_id, file_path, description, recorded_by)
      OUTPUT INSERTED.id
      VALUES (@chicken_id, @file_path, @description, @recorded_by)
    `);

  const id = result.recordset[0].id;
  return (await getPhoto(id))!;
}

export async function listPhotos(chicken_id: number): Promise<Photo[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("chicken_id", sql.Int, chicken_id)
    .query(
      `${PHOTO_SELECT_SQL} WHERE p.chicken_id = @chicken_id ORDER BY p.created_at ASC`
    );
  return result.recordset as Photo[];
}

export async function getPhoto(id: number): Promise<Photo | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`${PHOTO_SELECT_SQL} WHERE p.id = @id`);
  return (result.recordset[0] as Photo) || null;
}

export async function updatePhoto(
  id: number,
  input: UpdatePhotoInput
): Promise<Photo | null> {
  const pool = await getPool();
  const sets: string[] = [];
  const request = pool.request().input("id", sql.Int, id);

  if (input.description !== undefined) {
    sets.push("description = @description");
    request.input("description", sql.NVarChar(1000), input.description);
  }

  if (sets.length === 0) return getPhoto(id);

  await request.query(`UPDATE photos SET ${sets.join(", ")} WHERE id = @id`);
  return getPhoto(id);
}

export async function deletePhoto(id: number): Promise<boolean> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query("DELETE FROM photos WHERE id = @id");
  return result.rowsAffected[0]! > 0;
}

export async function setPrimaryPhoto(
  chicken_id: number,
  photo_id: number | null
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("chicken_id", sql.Int, chicken_id)
    .input("photo_id", sql.Int, photo_id)
    .query("UPDATE chickens SET primary_photo_id = @photo_id WHERE id = @chicken_id");
}

export async function setPhotoThumbnail(
  photo_id: number,
  thumbnail_path: string
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("id", sql.Int, photo_id)
    .input("thumbnail_path", sql.NVarChar(500), thumbnail_path)
    .query("UPDATE photos SET thumbnail_path = @thumbnail_path WHERE id = @id");
}

export type PhotoWithChicken = Photo & {
  chicken_name: string;
};

export async function listAllPhotos(): Promise<PhotoWithChicken[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .query(`
      SELECT
        p.id, p.chicken_id, p.file_path, p.thumbnail_path, p.description, p.recorded_by,
        CONVERT(varchar, p.created_at, 20) AS created_at,
        c.name AS chicken_name
      FROM photos p
      JOIN chickens c ON c.id = p.chicken_id
      ORDER BY p.created_at ASC
    `);
  return result.recordset as PhotoWithChicken[];
}

export function getImageDirectory(): string {
  return process.env.IMAGE_DIR || "./images";
}
