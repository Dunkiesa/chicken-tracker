import sql from "mssql";
import { getPool } from "./db";

export type DynamicListType = "breeds" | "origin_sources" | "acquisition_types";

export type DynamicListEntry = {
  id: number;
  value: string;
};

const TABLE_MAP: Record<DynamicListType, string> = {
  breeds: "breeds",
  origin_sources: "origin_sources",
  acquisition_types: "acquisition_types",
};

const FK_MAP: Record<DynamicListType, string> = {
  breeds: "breed_id",
  origin_sources: "origin_source_id",
  acquisition_types: "acquisition_type_id",
};

function table(type: DynamicListType): string {
  return TABLE_MAP[type];
}

function fk(type: DynamicListType): string {
  return FK_MAP[type];
}

export async function listValues(type: DynamicListType): Promise<DynamicListEntry[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .query(`SELECT id, value FROM ${table(type)} ORDER BY value`);
  return result.recordset;
}

export async function getOrCreateValue(type: DynamicListType, value: string): Promise<number> {
  const pool = await getPool();
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Value cannot be empty");

  const existing = await pool
    .request()
    .input("value", sql.NVarChar(255), trimmed)
    .query(`SELECT id FROM ${table(type)} WHERE LOWER(value) = LOWER(@value)`);

  if (existing.recordset.length > 0) return existing.recordset[0].id;

  const result = await pool
    .request()
    .input("value", sql.NVarChar(255), trimmed)
    .query(`INSERT INTO ${table(type)} (value) OUTPUT INSERTED.id VALUES (@value)`);

  return result.recordset[0].id;
}

export async function createValue(type: DynamicListType, value: string): Promise<DynamicListEntry> {
  const pool = await getPool();
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Value cannot be empty");

  const result = await pool
    .request()
    .input("value", sql.NVarChar(255), trimmed)
    .query(`INSERT INTO ${table(type)} (value) OUTPUT INSERTED.id, INSERTED.value VALUES (@value)`);

  return result.recordset[0];
}

export async function renameValue(type: DynamicListType, id: number, newValue: string): Promise<void> {
  const pool = await getPool();
  const trimmed = newValue.trim();
  if (!trimmed) throw new Error("Value cannot be empty");

  await pool
    .request()
    .input("id", sql.Int, id)
    .input("value", sql.NVarChar(255), trimmed)
    .query(`UPDATE ${table(type)} SET value = @value WHERE id = @id`);
}

export async function removeValue(type: DynamicListType, id: number): Promise<void> {
  const pool = await getPool();
  const usage = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`SELECT COUNT(*) AS cnt FROM chickens WHERE ${fk(type)} = @id`);

  if (usage.recordset[0].cnt > 0) {
    throw new Error("Cannot remove a value that is in use by one or more chickens");
  }

  await pool
    .request()
    .input("id", sql.Int, id)
    .query(`DELETE FROM ${table(type)} WHERE id = @id`);
}

export async function mergeValues(type: DynamicListType, sourceId: number, targetId: number): Promise<void> {
  if (sourceId === targetId) throw new Error("Cannot merge a value into itself");

  const pool = await getPool();

  await pool
    .request()
    .input("sourceId", sql.Int, sourceId)
    .input("targetId", sql.Int, targetId)
    .query(`UPDATE chickens SET ${fk(type)} = @targetId WHERE ${fk(type)} = @sourceId`);

  await pool
    .request()
    .input("id", sql.Int, sourceId)
    .query(`DELETE FROM ${table(type)} WHERE id = @id`);
}
