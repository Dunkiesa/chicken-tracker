import sql from "mssql";
import { getPool } from "./db";

export type Egg = {
  id: number;
  chicken_id: number;
  chicken_name: string;
  weight: number;
  date: string;
  recorded_by: string;
  created_at: string;
  updated_at: string;
};

export type CreateEggInput = {
  chicken_id: number;
  weight: number;
  date: string;
  recorded_by: string;
};

export type UpdateEggInput = {
  chicken_id?: number;
  weight?: number;
  date?: string;
};

export type LayingContext = {
  chicken_id: number;
  chicken_name: string;
  last_egg_date: string | null;
  recent_avg_weight: number | null;
};

export type CreateEggWarning = {
  type: "duplicate_date" | "weight_out_of_range";
  message: string;
};

const EGG_SELECT_SQL = `
  SELECT
    e.id, e.chicken_id, c.name AS chicken_name, e.weight,
    CONVERT(varchar, e.date, 23) AS date,
    e.recorded_by,
    CONVERT(varchar, e.created_at, 20) AS created_at,
    CONVERT(varchar, e.updated_at, 20) AS updated_at
  FROM eggs e
  JOIN chickens c ON e.chicken_id = c.id
`;

export async function createEgg(
  input: CreateEggInput,
  overrideDuplicate = false
): Promise<{ egg: Egg; warnings: CreateEggWarning[] }> {
  const pool = await getPool();
  const warnings: CreateEggWarning[] = [];

  if (!overrideDuplicate) {
    const existing = await pool
      .request()
      .input("chicken_id", sql.Int, input.chicken_id)
      .input("date", sql.Date, input.date)
      .query(
        "SELECT id FROM eggs WHERE chicken_id = @chicken_id AND date = @date"
      );

    if (existing.recordset.length > 0) {
      warnings.push({
        type: "duplicate_date",
        message: `${input.chicken_id} already has an egg logged for ${input.date}`,
      });
    }
  }

  if (input.weight < 20 || input.weight > 200) {
    warnings.push({
      type: "weight_out_of_range",
      message: `Weight ${input.weight}g is outside the typical range of 20–200g`,
    });
  }

  const result = await pool
    .request()
    .input("chicken_id", sql.Int, input.chicken_id)
    .input("weight", sql.Decimal(5, 2), input.weight)
    .input("date", sql.Date, input.date)
    .input("recorded_by", sql.NVarChar(255), input.recorded_by)
    .query(`
      INSERT INTO eggs (chicken_id, weight, date, recorded_by)
      OUTPUT INSERTED.id
      VALUES (@chicken_id, @weight, @date, @recorded_by)
    `);

  const id = result.recordset[0].id;
  const egg = await getEgg(id);
  return { egg: egg!, warnings };
}

export async function createEggs(
  inputs: CreateEggInput[],
  overrideDuplicate = false
): Promise<{ eggs: Egg[]; warnings: CreateEggWarning[][] }> {
  if (inputs.length === 0) {
    return { eggs: [], warnings: [] };
  }

  const pool = await getPool();
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    const eggs: Egg[] = [];
    const warnings: CreateEggWarning[][] = [];

    for (const input of inputs) {
      const eggWarnings: CreateEggWarning[] = [];

      if (!overrideDuplicate) {
        const existing = await transaction
          .request()
          .input("chicken_id", sql.Int, input.chicken_id)
          .input("date", sql.Date, input.date)
          .query(
            "SELECT id FROM eggs WHERE chicken_id = @chicken_id AND date = @date"
          );

        if (existing.recordset.length > 0) {
          eggWarnings.push({
            type: "duplicate_date",
            message: `${input.chicken_id} already has an egg logged for ${input.date}`,
          });
        }
      }

      if (input.weight < 20 || input.weight > 200) {
        eggWarnings.push({
          type: "weight_out_of_range",
          message: `Weight ${input.weight}g is outside the typical range of 20–200g`,
        });
      }

      const result = await transaction
        .request()
        .input("chicken_id", sql.Int, input.chicken_id)
        .input("weight", sql.Decimal(5, 2), input.weight)
        .input("date", sql.Date, input.date)
        .input("recorded_by", sql.NVarChar(255), input.recorded_by)
        .query(`
          INSERT INTO eggs (chicken_id, weight, date, recorded_by)
          OUTPUT INSERTED.id
          VALUES (@chicken_id, @weight, @date, @recorded_by)
        `);

      const id = result.recordset[0].id;
      const eggResult = await transaction
        .request()
        .input("id", sql.Int, id)
        .query(`${EGG_SELECT_SQL} WHERE e.id = @id`);
      const egg = (eggResult.recordset[0] as Egg) || null;
      eggs.push(egg!);
      warnings.push(eggWarnings);
    }

    await transaction.commit();
    return { eggs, warnings };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function listEggs(
  filters?: {
    date?: string;
    chicken_id?: number;
    date_from?: string;
    date_to?: string;
  }
): Promise<Egg[]> {
  const pool = await getPool();
  const conditions: string[] = [];
  const request = pool.request();

  if (filters?.date) {
    conditions.push("e.date = @date");
    request.input("date", sql.Date, filters.date);
  }
  if (filters?.chicken_id) {
    conditions.push("e.chicken_id = @chicken_id");
    request.input("chicken_id", sql.Int, filters.chicken_id);
  }
  if (filters?.date_from) {
    conditions.push("e.date >= @date_from");
    request.input("date_from", sql.Date, filters.date_from);
  }
  if (filters?.date_to) {
    conditions.push("e.date <= @date_to");
    request.input("date_to", sql.Date, filters.date_to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await request.query(
    `${EGG_SELECT_SQL} ${where} ORDER BY e.date DESC, e.id DESC`
  );
  return result.recordset as Egg[];
}

export async function getEgg(id: number): Promise<Egg | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`${EGG_SELECT_SQL} WHERE e.id = @id`);
  return (result.recordset[0] as Egg) || null;
}

export async function updateEgg(
  id: number,
  input: UpdateEggInput
): Promise<Egg | null> {
  const pool = await getPool();
  const sets: string[] = [];
  const request = pool.request().input("id", sql.Int, id);

  if (input.chicken_id !== undefined) {
    sets.push("chicken_id = @chicken_id");
    request.input("chicken_id", sql.Int, input.chicken_id);
  }
  if (input.weight !== undefined) {
    sets.push("weight = @weight");
    request.input("weight", sql.Decimal(5, 2), input.weight);
  }
  if (input.date !== undefined) {
    sets.push("date = @date");
    request.input("date", sql.Date, input.date);
  }

  if (sets.length === 0) return getEgg(id);

  sets.push("updated_at = GETDATE()");
  await request.query(`UPDATE eggs SET ${sets.join(", ")} WHERE id = @id`);

  return getEgg(id);
}

export async function deleteEgg(id: number): Promise<boolean> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query("DELETE FROM eggs WHERE id = @id");
  return result.rowsAffected[0] > 0;
}

export async function checkDuplicate(
  chicken_id: number,
  date: string,
  excludeEggId?: number
  ): Promise<number | null> {
  const pool = await getPool();
  const request = pool
    .request()
    .input("chicken_id", sql.Int, chicken_id)
    .input("date", sql.Date, date);

  let query = "SELECT id FROM eggs WHERE chicken_id = @chicken_id AND date = @date";
  if (excludeEggId) {
    query += " AND id != @exclude_id";
    request.input("exclude_id", sql.Int, excludeEggId);
  }

  const result = await request.query(query);
  return result.recordset[0]?.id ?? null;
}

export async function getLastUsedChicken(
  email: string
): Promise<{ chicken_id: number; chicken_name: string } | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("email", sql.NVarChar(255), email)
    .query(`
      SELECT TOP 1 e.chicken_id, c.name AS chicken_name
      FROM eggs e
      JOIN chickens c ON e.chicken_id = c.id
      WHERE e.recorded_by = @email
      ORDER BY e.created_at DESC
    `);
  return result.recordset[0] || null;
}

export async function getLayingContext(): Promise<LayingContext[]> {
  const pool = await getPool();

  const context = await pool.request().query(`
    SELECT
      c.id AS chicken_id,
      c.name AS chicken_name,
      CONVERT(varchar, last_egg.last_date, 23) AS last_egg_date,
      CAST(avg_weight.avg_weight AS DECIMAL(5,2)) AS recent_avg_weight
    FROM chickens c
    LEFT JOIN (
      SELECT chicken_id, MAX(date) AS last_date
      FROM eggs
      GROUP BY chicken_id
    ) last_egg ON c.id = last_egg.chicken_id
    LEFT JOIN (
      SELECT chicken_id, AVG(CAST(weight AS DECIMAL(5,2))) AS avg_weight
      FROM eggs
      WHERE date >= DATEADD(DAY, -14, GETDATE())
      GROUP BY chicken_id
    ) avg_weight ON c.id = avg_weight.chicken_id
    WHERE c.sex IN ('Hen', 'Unknown') AND c.departed = 0
    ORDER BY c.name
  `);

  return context.recordset.map((row) => ({
    chicken_id: row.chicken_id,
    chicken_name: row.chicken_name,
    last_egg_date: row.last_egg_date ?? null,
    recent_avg_weight: row.recent_avg_weight
      ? parseFloat(row.recent_avg_weight)
      : null,
  }));
}
