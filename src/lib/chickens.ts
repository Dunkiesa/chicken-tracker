import sql from "mssql";
import { getPool } from "./db";
import { getOrCreateValue } from "./dynamic-lists";

export type Sex = "Hen" | "Rooster" | "Unknown";

export type Chicken = {
  id: number;
  name: string;
  sex: Sex;
  breed_id: number | null;
  breed_name: string | null;
  origin_source_id: number | null;
  origin_source_name: string | null;
  acquisition_type_id: number | null;
  acquisition_type_name: string | null;
  departed: boolean;
  departure_date: string | null;
  departure_reason: string | null;
  created_at: string;
  primary_photo_id: number | null;
  primary_photo_path: string | null;
};

export type CreateChickenInput = {
  name: string;
  sex: Sex;
  breed?: string;
  origin_source?: string;
  acquisition_type?: string;
};

export type UpdateChickenInput = {
  name?: string;
  sex?: Sex;
  breed?: string | null;
  origin_source?: string | null;
  acquisition_type?: string | null;
  departed?: boolean;
  departure_date?: string | null;
  departure_reason?: string | null;
};

const LIST_JOIN_SQL = `
  SELECT
    c.id, c.name, c.sex, c.departed,
    CONVERT(varchar, c.departure_date, 23) AS departure_date,
    c.departure_reason,
    CONVERT(varchar, c.created_at, 20) AS created_at,
    c.breed_id, b.value AS breed_name,
    c.origin_source_id, os.value AS origin_source_name,
    c.acquisition_type_id, atv.value AS acquisition_type_name,
    c.primary_photo_id,
    pp.file_path AS primary_photo_path
  FROM chickens c
  LEFT JOIN breeds b ON c.breed_id = b.id
  LEFT JOIN origin_sources os ON c.origin_source_id = os.id
  LEFT JOIN acquisition_types atv ON c.acquisition_type_id = atv.id
  LEFT JOIN photos pp ON c.primary_photo_id = pp.id
`;

export async function createChicken(input: CreateChickenInput): Promise<Chicken> {
  const pool = await getPool();
  const trimmed = input.name.trim();
  const breedId = input.breed?.trim() ? await getOrCreateValue("breeds", input.breed) : null;
  const originSourceId = input.origin_source?.trim() ? await getOrCreateValue("origin_sources", input.origin_source) : null;
  const acquisitionTypeId = input.acquisition_type?.trim() ? await getOrCreateValue("acquisition_types", input.acquisition_type) : null;

  const insertResult = await pool
    .request()
    .input("name", sql.NVarChar(255), trimmed)
    .input("sex", sql.NVarChar(50), input.sex)
    .input("breed_id", sql.Int, breedId)
    .input("origin_source_id", sql.Int, originSourceId)
    .input("acquisition_type_id", sql.Int, acquisitionTypeId)
    .query(`
      INSERT INTO chickens (name, sex, breed_id, origin_source_id, acquisition_type_id)
      OUTPUT INSERTED.id
      VALUES (@name, @sex, @breed_id, @origin_source_id, @acquisition_type_id)
    `);

  const id = insertResult.recordset[0].id;
  const full = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`${LIST_JOIN_SQL} WHERE c.id = @id`);

  return full.recordset[0] as Chicken;
}

export async function listChickens(includeDeparted = false): Promise<Chicken[]> {
  const pool = await getPool();
  const query = includeDeparted
    ? `${LIST_JOIN_SQL} ORDER BY c.name`
    : `${LIST_JOIN_SQL} WHERE c.departed = 0 ORDER BY c.name`;
  const result = await pool.request().query(query);
  return result.recordset as Chicken[];
}

export async function getChicken(id: number): Promise<Chicken | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`${LIST_JOIN_SQL} WHERE c.id = @id`);
  return (result.recordset[0] as Chicken) || null;
}

export async function updateChicken(id: number, input: UpdateChickenInput): Promise<Chicken | null> {
  const pool = await getPool();
  const sets: string[] = [];
  const request = pool.request().input("id", sql.Int, id);

  if (input.name !== undefined) {
    sets.push("name = @name");
    request.input("name", sql.NVarChar(255), input.name.trim());
  }
  if (input.sex !== undefined) {
    sets.push("sex = @sex");
    request.input("sex", sql.NVarChar(50), input.sex);
  }
  if (input.breed !== undefined) {
    const bid = input.breed ? await getOrCreateValue("breeds", input.breed) : null;
    sets.push("breed_id = @breed_id");
    request.input("breed_id", sql.Int, bid);
  }
  if (input.origin_source !== undefined) {
    const oid = input.origin_source ? await getOrCreateValue("origin_sources", input.origin_source) : null;
    sets.push("origin_source_id = @origin_source_id");
    request.input("origin_source_id", sql.Int, oid);
  }
  if (input.acquisition_type !== undefined) {
    const aid = input.acquisition_type ? await getOrCreateValue("acquisition_types", input.acquisition_type) : null;
    sets.push("acquisition_type_id = @acquisition_type_id");
    request.input("acquisition_type_id", sql.Int, aid);
  }
  if (input.departed !== undefined) {
    sets.push("departed = @departed");
    request.input("departed", sql.Bit, input.departed);
  }
  if (input.departure_date !== undefined) {
    sets.push("departure_date = @departure_date");
    request.input("departure_date", sql.Date, input.departure_date);
  }
  if (input.departure_reason !== undefined) {
    sets.push("departure_reason = @departure_reason");
    request.input("departure_reason", sql.NVarChar(255), input.departure_reason);
  }

  if (sets.length === 0) return getChicken(id);

  await request.query(`UPDATE chickens SET ${sets.join(", ")} WHERE id = @id`);

  return getChicken(id);
}
