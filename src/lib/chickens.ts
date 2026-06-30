import sql from "mssql";
import { getPool } from "./db";

export type Chicken = {
  id: number;
  name: string;
};

export async function createChicken(name: string): Promise<Chicken> {
  const pool = await getPool();
  const trimmed = name.trim();
  const result = await pool
    .request()
    .input("name", sql.NVarChar(255), trimmed)
    .query(
      "INSERT INTO chickens (name) OUTPUT INSERTED.id, INSERTED.name VALUES (@name)"
    );
  return result.recordset[0] as Chicken;
}

export async function listChickens(): Promise<Chicken[]> {
  const pool = await getPool();
  const result = await pool.request().query(
    "SELECT id, name FROM chickens ORDER BY id"
  );
  return result.recordset as Chicken[];
}
