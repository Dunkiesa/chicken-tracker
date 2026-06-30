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

async function getPool(): Promise<sql.ConnectionPool> {
  if (pool) return pool;
  pool = await sql.connect(config);
  return pool;
}

export async function ensureDatabase(): Promise<void> {
  const masterConfig = { ...config, database: "master" };
  const masterPool = await sql.connect(masterConfig);
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
