import EventEmitter from "events";

describe("Database connection resilience and recovery", () => {
  let mockPools: any[] = [];
  let connectMock: jest.Mock | null = null;
  let queryMock: jest.Mock;
  let closeMock: jest.Mock;
  let dbModule: typeof import("@/lib/db");

  beforeEach(async () => {
    jest.resetModules();
    mockPools = [];
    connectMock = null;

    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    queryMock = jest.fn().mockResolvedValue({ recordset: [{ cnt: 0 }] });
    closeMock = jest.fn().mockResolvedValue(undefined);

    class MockRequest {
      input() {
        return this;
      }
      async query(q: string) {
        return queryMock(q);
      }
    }

    class MockConnectionPool extends EventEmitter {
      config: any;
      connected: boolean = false;
      close: jest.Mock;

      constructor(config: any) {
        super();
        this.config = config;
        this.close = jest.fn().mockImplementation(async () => {
          this.connected = false;
          return closeMock();
        });
        mockPools.push(this);
      }

      async connect() {
        if (connectMock) {
          await connectMock(this);
        }
        this.connected = true;
        return this;
      }

      request() {
        return new MockRequest();
      }
    }

    jest.doMock("mssql", () => ({
      __esModule: true,
      default: {
        ConnectionPool: MockConnectionPool,
        NVarChar: jest.fn((len) => `NVarChar(${len})`),
      },
      ConnectionPool: MockConnectionPool,
      NVarChar: jest.fn((len) => `NVarChar(${len})`),
    }));

    dbModule = await import("@/lib/db");
    await dbModule.closePool();
  });

  afterEach(async () => {
    if (dbModule) {
      await dbModule.closePool();
    }
    jest.restoreAllMocks();
  });

  it("retries connection after a rejected connection attempt (does not latch failed promise)", async () => {
    let attempts = 0;
    connectMock = jest.fn().mockImplementation(async (pool) => {
      attempts++;
      if (attempts === 1) {
        throw new Error("SQL Server connection refused (offline)");
      }
      return pool;
    });

    // First attempt fails
    await expect(dbModule.getPool()).rejects.toThrow("SQL Server connection refused (offline)");

    // Second attempt succeeds after server comes online
    const pool = await dbModule.getPool();
    expect(pool).toBeDefined();
    expect(pool.connected).toBe(true);
    expect(attempts).toBeGreaterThanOrEqual(2);
  });

  it("coalesces concurrent getPool calls into a single connection attempt", async () => {
    let masterPoolConnects = 0;
    let mainPoolConnects = 0;

    connectMock = jest.fn().mockImplementation(async (pool) => {
      if (pool.config?.database === "master") {
        masterPoolConnects++;
      } else {
        mainPoolConnects++;
      }
      // Simulate connection latency
      await new Promise((resolve) => setTimeout(resolve, 20));
      return pool;
    });

    const [p1, p2, p3] = await Promise.all([
      dbModule.getPool(),
      dbModule.getPool(),
      dbModule.getPool(),
    ]);

    expect(p1).toBe(p2);
    expect(p2).toBe(p3);
    expect(mainPoolConnects).toBe(1);
    expect(p1.connected).toBe(true);
  });

  it("detects when activePool drops connection, discards it, and creates a fresh connection", async () => {
    connectMock = jest.fn().mockImplementation(async (pool) => pool);

    const pool1 = await dbModule.getPool();
    expect(pool1.connected).toBe(true);

    // Simulate connection drop / socket error
    (pool1 as any).connected = false;
    pool1.emit("error", new Error("Socket closed unexpectedly"));

    // Next getPool() should recycle dead pool and create a new connection
    const pool2 = await dbModule.getPool();
    expect(pool2).not.toBe(pool1);
    expect(pool2.connected).toBe(true);
  });

  it("checkConnection returns false on failure and resets pool for recovery", async () => {
    let shouldFailQuery = false;
    connectMock = jest.fn().mockImplementation(async (pool) => pool);
    queryMock.mockImplementation(async (q: string) => {
      if (shouldFailQuery && q.includes("SELECT 1")) {
        throw new Error("Connection reset by peer");
      }
      return { recordset: [{ cnt: 0 }] };
    });

    // Healthy initially
    const healthy1 = await dbModule.checkConnection();
    expect(healthy1).toBe(true);

    // Outage occurs
    shouldFailQuery = true;
    const healthy2 = await dbModule.checkConnection();
    expect(healthy2).toBe(false);

    // Recovery occurs
    shouldFailQuery = false;
    const healthy3 = await dbModule.checkConnection();
    expect(healthy3).toBe(true);
  });

  it("closePool cleanly resets activePool, poolPromise, and migrationsRun", async () => {
    let migrationRunCount = 0;
    queryMock.mockImplementation(async (q: string) => {
      if (q.includes("CREATE TABLE breeds")) {
        migrationRunCount++;
      }
      return { recordset: [{ cnt: 0 }] };
    });

    await dbModule.getPool();
    expect(migrationRunCount).toBe(1);

    // Calling getPool again should not re-run migrations because migrationsRun = true
    await dbModule.getPool();
    expect(migrationRunCount).toBe(1);

    // Close pool resets state
    await dbModule.closePool();

    // Next getPool should reconnect and re-run migrations
    await dbModule.getPool();
    expect(migrationRunCount).toBe(2);
  });
});
