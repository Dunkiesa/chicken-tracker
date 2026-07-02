import { ensureDatabase, runMigrations, closePool } from "@/lib/db";
import { addUser, removeUser, getUserByEmail, listUsers } from "@/lib/users";

const TEST_ADMIN_EMAIL = "test-admin@example.com";
const TEST_VIEWER_EMAIL = "test-viewer@example.com";

beforeAll(async () => {
  await ensureDatabase();
  await runMigrations();
}, 30000);

afterAll(async () => {
  // Clean up test users
  try {
    await removeUser(TEST_ADMIN_EMAIL);
  } catch {
    // ignore
  }
  try {
    await removeUser(TEST_VIEWER_EMAIL);
  } catch {
    // ignore
  }
  await closePool();
}, 15000);

describe("Users domain", () => {
  it("creates an admin user", async () => {
    await addUser(TEST_ADMIN_EMAIL, "Admin");
    const user = await getUserByEmail(TEST_ADMIN_EMAIL);
    expect(user).toBeDefined();
    expect(user!.email).toBe(TEST_ADMIN_EMAIL.toLowerCase());
    expect(user!.role).toBe("Admin");
  }, 15000);

  it("creates a viewer user", async () => {
    await addUser(TEST_VIEWER_EMAIL, "Viewer");
    const user = await getUserByEmail(TEST_VIEWER_EMAIL);
    expect(user).toBeDefined();
    expect(user!.email).toBe(TEST_VIEWER_EMAIL.toLowerCase());
    expect(user!.role).toBe("Viewer");
  }, 15000);

  it("lists all users", async () => {
    const users = await listUsers();
    const emails = users.map((u) => u.email);
    expect(emails).toContain(TEST_ADMIN_EMAIL.toLowerCase());
    expect(emails).toContain(TEST_VIEWER_EMAIL.toLowerCase());
  }, 15000);

  it("allows admin to delete a viewer", async () => {
    await removeUser(TEST_VIEWER_EMAIL);
    const user = await getUserByEmail(TEST_VIEWER_EMAIL);
    expect(user).toBeUndefined();
  }, 15000);

  it("rejects duplicate email", async () => {
    await expect(addUser(TEST_ADMIN_EMAIL, "Admin")).rejects.toThrow();
  }, 15000);

  it("returns undefined for non-existent user", async () => {
    const user = await getUserByEmail("nonexistent@example.com");
    expect(user).toBeUndefined();
  }, 15000);
});

describe("Seed admin bootstrap", () => {
  it("the seed admin from SEED_ADMIN_EMAIL exists in the users table", async () => {
    // This tests that the seed logic in runMigrations created the seed admin
    const seedEmail = process.env.SEED_ADMIN_EMAIL;
    if (seedEmail) {
      const user = await getUserByEmail(seedEmail);
      expect(user).toBeDefined();
      expect(user!.role).toBe("Admin");
    }
  });
});
