import sql from "mssql";
import { getPool } from "./db";

export type Role = "Admin" | "Viewer";

export type User = {
  email: string;
  role: Role;
  created_at?: Date;
};

export async function getUserByEmail(
  email: string
): Promise<User | undefined> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("email", sql.NVarChar(255), email)
    .query("SELECT email, role, created_at FROM users WHERE email = @email");
  return result.recordset[0] as User | undefined;
}

export async function listUsers(): Promise<User[]> {
  const pool = await getPool();
  const result = await pool.request().query(
    "SELECT email, role, created_at FROM users ORDER BY email"
  );
  return result.recordset as User[];
}

export async function addUser(
  email: string,
  role: Role
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("email", sql.NVarChar(255), email.trim().toLowerCase())
    .input("role", sql.NVarChar(50), role)
    .query("INSERT INTO users (email, role) VALUES (@email, @role)");
}

export async function removeUser(email: string): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("email", sql.NVarChar(255), email)
    .query("DELETE FROM users WHERE email = @email");
}

export async function updateUserRole(email: string, role: Role): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("email", sql.NVarChar(255), email.trim().toLowerCase())
    .input("role", sql.NVarChar(50), role)
    .query("UPDATE users SET role = @role WHERE email = @email");
}
