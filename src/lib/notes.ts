import sql from "mssql";
import { getPool } from "./db";
import { deleteNoteImagesForNote } from "./note_images";

export type Note = {
  id: number;
  chicken_id: number;
  chicken_name: string;
  content: string;
  date: string;
  is_medication: boolean;
  medication_duration_days: number | null;
  withdrawal_days: number | null;
  recorded_by: string;
  created_at: string;
  updated_at: string;
};

export type CreateNoteInput = {
  chicken_id: number;
  content: string;
  date: string;
  is_medication?: boolean;
  medication_duration_days?: number | null;
  withdrawal_days?: number | null;
  recorded_by: string;
};

export type UpdateNoteInput = {
  content?: string;
  date?: string;
  is_medication?: boolean;
  medication_duration_days?: number | null;
  withdrawal_days?: number | null;
};

const NOTE_SELECT_SQL = `
  SELECT
    n.id, n.chicken_id, c.name AS chicken_name, n.content,
    CONVERT(varchar, n.date, 23) AS date,
    n.is_medication, n.medication_duration_days, n.withdrawal_days,
    n.recorded_by,
    CONVERT(varchar, n.created_at, 20) AS created_at,
    CONVERT(varchar, n.updated_at, 20) AS updated_at
  FROM notes n
  JOIN chickens c ON n.chicken_id = c.id
`;

export async function createNote(input: CreateNoteInput): Promise<Note> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("chicken_id", sql.Int, input.chicken_id)
    .input("content", sql.NVarChar(sql.MAX), input.content.trim())
    .input("date", sql.Date, input.date)
    .input("is_medication", sql.Bit, input.is_medication ? 1 : 0)
    .input("medication_duration_days", sql.Int, input.medication_duration_days ?? null)
    .input("withdrawal_days", sql.Int, input.withdrawal_days ?? null)
    .input("recorded_by", sql.NVarChar(255), input.recorded_by)
    .query(`
      INSERT INTO notes (chicken_id, content, date, is_medication, medication_duration_days, withdrawal_days, recorded_by)
      OUTPUT INSERTED.id
      VALUES (@chicken_id, @content, @date, @is_medication, @medication_duration_days, @withdrawal_days, @recorded_by)
    `);

  const id = result.recordset[0].id;
  const note = await getNote(id);
  return note!;
}

export async function listNotes(chicken_id: number): Promise<Note[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("chicken_id", sql.Int, chicken_id)
    .query(
      `${NOTE_SELECT_SQL} WHERE n.chicken_id = @chicken_id ORDER BY n.date DESC, n.created_at DESC`
    );
  return result.recordset as Note[];
}

export async function getNote(id: number): Promise<Note | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`${NOTE_SELECT_SQL} WHERE n.id = @id`);
  return (result.recordset[0] as Note) || null;
}

export async function updateNote(
  id: number,
  input: UpdateNoteInput
): Promise<Note | null> {
  const pool = await getPool();
  const sets: string[] = [];
  const request = pool.request().input("id", sql.Int, id);

  if (input.content !== undefined) {
    sets.push("content = @content");
    request.input("content", sql.NVarChar(sql.MAX), input.content.trim());
  }
  if (input.date !== undefined) {
    sets.push("date = @date");
    request.input("date", sql.Date, input.date);
  }
  if (input.is_medication !== undefined) {
    sets.push("is_medication = @is_medication");
    request.input("is_medication", sql.Bit, input.is_medication ? 1 : 0);
  }
  if (input.medication_duration_days !== undefined) {
    sets.push("medication_duration_days = @medication_duration_days");
    request.input("medication_duration_days", sql.Int, input.medication_duration_days);
  }
  if (input.withdrawal_days !== undefined) {
    sets.push("withdrawal_days = @withdrawal_days");
    request.input("withdrawal_days", sql.Int, input.withdrawal_days);
  }

  if (sets.length === 0) return getNote(id);

  sets.push("updated_at = GETDATE()");
  await request.query(`UPDATE notes SET ${sets.join(", ")} WHERE id = @id`);

  return getNote(id);
}

export async function deleteNote(id: number): Promise<boolean> {
  await deleteNoteImagesForNote(id);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query("DELETE FROM notes WHERE id = @id");
  return result.rowsAffected[0]! > 0;
}
