import { ensureDatabase, checkConnection, closePool } from "@/lib/db";

beforeAll(async () => {
  await ensureDatabase();
}, 30000);

afterAll(async () => {
  await closePool();
});

describe("Health endpoint DB round-trip", () => {
  it("returns true when database is reachable", async () => {
    const result = await checkConnection();
    expect(result).toBe(true);
  }, 15000);
});
