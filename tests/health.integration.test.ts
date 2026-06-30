import { ensureDatabase, checkConnection } from "@/lib/db";

beforeAll(async () => {
  await ensureDatabase();
}, 30000);

describe("Health endpoint DB round-trip", () => {
  it("returns true when database is reachable", async () => {
    const result = await checkConnection();
    expect(result).toBe(true);
  }, 15000);
});
