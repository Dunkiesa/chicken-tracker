import { ensureDatabase, runMigrations } from "@/lib/db";
import { createChicken, listChickens, Chicken } from "@/lib/chickens";

beforeAll(async () => {
  await ensureDatabase();
  await runMigrations();
}, 30000);

describe("Chickens", () => {
  it("creates a chicken and assigns a unique ID", async () => {
    const chicken = await createChicken("Henrietta");
    expect(chicken).toBeDefined();
    expect(chicken.name).toBe("Henrietta");
    expect(typeof chicken.id).toBe("number");
  }, 15000);

  it("lists all enrolled chickens", async () => {
    const before = await listChickens();
    const beforeNames = before.map((c: Chicken) => c.name);

    if (!beforeNames.includes("Cluck Norris")) {
      await createChicken("Cluck Norris");
    }
    if (!beforeNames.includes("Egg Sheeran")) {
      await createChicken("Egg Sheeran");
    }

    const after = await listChickens();
    const afterNames = after.map((c: Chicken) => c.name);
    expect(afterNames).toContain("Cluck Norris");
    expect(afterNames).toContain("Egg Sheeran");
  }, 15000);

  it("rejects duplicate names", async () => {
    await createChicken("Dup Test");
    await expect(createChicken("Dup Test")).rejects.toThrow();
  }, 15000);

  it("trims whitespace from names", async () => {
    const chicken = await createChicken("  Trimmed Hen  ");
    expect(chicken.name).toBe("Trimmed Hen");
  }, 15000);
});
