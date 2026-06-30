import sql from "mssql";

const config: sql.config = {
  server: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "1433", 10),
  database: process.env.DB_NAME || "ChickenTrack",
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool) return pool;
  const p = new sql.ConnectionPool(config);
  pool = await p.connect();
  return pool;
}

export async function ensureDatabase(): Promise<void> {
  const masterConfig = { ...config, database: "master" };
  const masterPool = new sql.ConnectionPool(masterConfig);
  await masterPool.connect();
  await masterPool.request().query(
    `IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '${config.database}')
     CREATE DATABASE ${config.database}`
  );
  await masterPool.close();
}

export async function checkConnection(): Promise<boolean> {
  try {
    const p = await getPool();
    await p.request().query("SELECT 1 AS result");
    return true;
  } catch {
    return false;
  }
}

export async function runMigrations(): Promise<void> {
  const p = await getPool();
  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'chickens')
    CREATE TABLE chickens (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(255) NOT NULL UNIQUE
    )
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
    CREATE TABLE users (
      email NVARCHAR(255) PRIMARY KEY,
      role NVARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Viewer')),
      created_at DATETIME2 DEFAULT GETDATE()
    )
  `);

  const seedEmail = process.env.SEED_ADMIN_EMAIL;
  if (seedEmail) {
    const countResult = await p
      .request()
      .query("SELECT COUNT(*) AS cnt FROM users");
    const count = countResult.recordset[0].cnt;
    if (count === 0) {
      await p
        .request()
        .input("email", sql.NVarChar(255), seedEmail)
        .input("role", sql.NVarChar(50), "Admin")
        .query(
          "INSERT INTO users (email, role) VALUES (@email, @role)"
        );
    }
  }
}
