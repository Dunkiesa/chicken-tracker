import sql from "mssql";
import { getPool } from "./db";

export type Note = {
  id: number;
  chicken_id: number;
  chicken_name: string;
  content: string;
  date: string;
  recorded_by: string;
  created_at: string;
  updated_at: string;
};

export type CreateNoteInput = {
  chicken_id: number;
  content: string;
  date: string;
  recorded_by: string;
};

export type UpdateNoteInput = {
  content?: string;
  date?: string;
};

const NOTE_SELECT_SQL = `
  SELECT
    n.id, n.chicken_id, c.name AS chicken_name, n.content,
    CONVERT(varchar, n.date, 23) AS date,
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
    .input("recorded_by", sql.NVarChar(255), input.recorded_by)
    .query(`
      INSERT INTO notes (chicken_id, content, date, recorded_by)
      OUTPUT INSERTED.id
      VALUES (@chicken_id, @content, @date, @recorded_by)
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

  if (sets.length === 0) return getNote(id);

  sets.push("updated_at = GETDATE()");
  await request.query(`UPDATE notes SET ${sets.join(", ")} WHERE id = @id`);

  return getNote(id);
}

export async function deleteNote(id: number): Promise<boolean> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query("DELETE FROM notes WHERE id = @id");
  return result.rowsAffected[0]! > 0;
}
