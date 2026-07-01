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

let poolPromise: Promise<sql.ConnectionPool> | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect();
  }
  return poolPromise;
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

  // -- Dynamic list tables --
  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'breeds')
    CREATE TABLE breeds (
      id INT IDENTITY(1,1) PRIMARY KEY,
      value NVARCHAR(255) NOT NULL UNIQUE
    )
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'origin_sources')
    CREATE TABLE origin_sources (
      id INT IDENTITY(1,1) PRIMARY KEY,
      value NVARCHAR(255) NOT NULL UNIQUE
    )
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'acquisition_types')
    CREATE TABLE acquisition_types (
      id INT IDENTITY(1,1) PRIMARY KEY,
      value NVARCHAR(255) NOT NULL UNIQUE
    )
  `);

  // -- Core tables --
  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'chickens')
    CREATE TABLE chickens (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(255) NOT NULL UNIQUE,
      sex NVARCHAR(50) NOT NULL DEFAULT 'Unknown',
      breed_id INT NULL REFERENCES breeds(id),
      origin_source_id INT NULL REFERENCES origin_sources(id),
      acquisition_type_id INT NULL REFERENCES acquisition_types(id),
      departed BIT NOT NULL DEFAULT 0,
      departure_date DATE NULL,
      departure_reason NVARCHAR(255) NULL,
      created_at DATETIME2 DEFAULT GETDATE()
    )
  `);

  // -- Add columns to existing chickens table (idempotent) --
  // Each ALTER TABLE is in its own query to avoid SQL Server batch-level
  // name resolution issues with CHECK constraints referencing new columns.
  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('chickens') AND name = 'sex')
      ALTER TABLE chickens ADD sex NVARCHAR(50) NOT NULL DEFAULT 'Unknown'
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_chickens_sex' AND parent_object_id = OBJECT_ID('chickens'))
      EXEC('ALTER TABLE dbo.chickens ADD CONSTRAINT CK_chickens_sex CHECK (sex IN (''Hen'', ''Rooster'', ''Unknown''))')
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('chickens') AND name = 'breed_id')
      ALTER TABLE chickens ADD breed_id INT NULL
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_chickens_breeds')
      EXEC('ALTER TABLE dbo.chickens ADD CONSTRAINT FK_chickens_breeds FOREIGN KEY (breed_id) REFERENCES dbo.breeds(id)')
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('chickens') AND name = 'origin_source_id')
      ALTER TABLE chickens ADD origin_source_id INT NULL
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_chickens_origin_sources')
      EXEC('ALTER TABLE dbo.chickens ADD CONSTRAINT FK_chickens_origin_sources FOREIGN KEY (origin_source_id) REFERENCES dbo.origin_sources(id)')
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('chickens') AND name = 'acquisition_type_id')
      ALTER TABLE chickens ADD acquisition_type_id INT NULL
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_chickens_acquisition_types')
      EXEC('ALTER TABLE dbo.chickens ADD CONSTRAINT FK_chickens_acquisition_types FOREIGN KEY (acquisition_type_id) REFERENCES dbo.acquisition_types(id)')
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('chickens') AND name = 'departed')
      ALTER TABLE chickens ADD departed BIT NOT NULL DEFAULT 0
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('chickens') AND name = 'departure_date')
      ALTER TABLE chickens ADD departure_date DATE NULL
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('chickens') AND name = 'departure_reason')
      ALTER TABLE chickens ADD departure_reason NVARCHAR(255) NULL
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('chickens') AND name = 'created_at')
      ALTER TABLE chickens ADD created_at DATETIME2 DEFAULT GETDATE()
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
    CREATE TABLE users (
      email NVARCHAR(255) PRIMARY KEY,
      role NVARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Viewer')),
      created_at DATETIME2 DEFAULT GETDATE()
    )
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'eggs')
    CREATE TABLE eggs (
      id INT IDENTITY(1,1) PRIMARY KEY,
      chicken_id INT NOT NULL REFERENCES chickens(id),
      weight DECIMAL(5,2) NOT NULL,
      date DATE NOT NULL,
      recorded_by NVARCHAR(255) NOT NULL,
      created_at DATETIME2 DEFAULT GETDATE(),
      updated_at DATETIME2 DEFAULT GETDATE()
    )
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'notes')
    CREATE TABLE notes (
      id INT IDENTITY(1,1) PRIMARY KEY,
      chicken_id INT NOT NULL REFERENCES chickens(id),
      content NVARCHAR(MAX) NOT NULL,
      date DATE NOT NULL,
      recorded_by NVARCHAR(255) NOT NULL,
      created_at DATETIME2 DEFAULT GETDATE(),
      updated_at DATETIME2 DEFAULT GETDATE()
    )
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'photos')
    CREATE TABLE photos (
      id INT IDENTITY(1,1) PRIMARY KEY,
      chicken_id INT NOT NULL REFERENCES chickens(id),
      file_path NVARCHAR(500) NOT NULL,
      description NVARCHAR(1000) NULL,
      recorded_by NVARCHAR(255) NOT NULL,
      created_at DATETIME2 DEFAULT GETDATE()
    )
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('chickens') AND name = 'primary_photo_id')
      ALTER TABLE chickens ADD primary_photo_id INT NULL
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_chickens_primary_photo')
      EXEC('ALTER TABLE dbo.chickens ADD CONSTRAINT FK_chickens_primary_photo FOREIGN KEY (primary_photo_id) REFERENCES dbo.photos(id)')
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
