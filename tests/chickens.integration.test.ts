import { ensureDatabase, runMigrations, getPool, closePool } from "@/lib/db";
import { createChicken, listChickens, updateChicken, type Chicken } from "@/lib/chickens";
import { listValues, createValue, renameValue, removeValue, mergeValues } from "@/lib/dynamic-lists";

beforeAll(async () => {
  await ensureDatabase();
  await runMigrations();
}, 30000);

beforeEach(async () => {
  const pool = await getPool();
  // Break circular FK: chickens.primary_photo_id → photos, photos.chicken_id → chickens
  await pool.request().query("UPDATE chickens SET primary_photo_id = NULL WHERE primary_photo_id IS NOT NULL");
  await pool.request().query("DELETE FROM photos");
  await pool.request().query("DELETE FROM notes");
  await pool.request().query("DELETE FROM eggs");
  await pool.request().query("DELETE FROM chickens");
  await pool.request().query("DELETE FROM acquisition_types");
  await pool.request().query("DELETE FROM origin_sources");
  await pool.request().query("DELETE FROM breeds");
}, 30000);

afterAll(async () => {
  await closePool();
});

describe("Chickens", () => {
  it("creates a chicken with full enrollment and assigns a unique ID", async () => {
    const chicken = await createChicken({
      name: "Henrietta",
      sex: "Hen",
      breed: "Rhode Island Red",
      origin_source: "Local Hatchery",
      acquisition_type: "Purchased",
    });
    expect(chicken).toBeDefined();
    expect(chicken.name).toBe("Henrietta");
    expect(chicken.sex).toBe("Hen");
    expect(chicken.breed_name).toBe("Rhode Island Red");
    expect(chicken.origin_source_name).toBe("Local Hatchery");
    expect(chicken.acquisition_type_name).toBe("Purchased");
    expect(typeof chicken.id).toBe("number");
  }, 15000);

  it("creates a chicken with minimal fields (name + sex only)", async () => {
    const chicken = await createChicken({ name: "Minimal Hen", sex: "Unknown" });
    expect(chicken.name).toBe("Minimal Hen");
    expect(chicken.sex).toBe("Unknown");
    expect(chicken.breed_name).toBeNull();
    expect(chicken.origin_source_name).toBeNull();
    expect(chicken.acquisition_type_name).toBeNull();
  }, 15000);

  it("lists all enrolled chickens (non-departed by default)", async () => {
    const before = await listChickens();
    const beforeNames = before.map((c: Chicken) => c.name);

    if (!beforeNames.includes("Cluck Norris")) {
      await createChicken({ name: "Cluck Norris", sex: "Rooster" });
    }
    if (!beforeNames.includes("Egg Sheeran")) {
      await createChicken({ name: "Egg Sheeran", sex: "Hen" });
    }

    const after = await listChickens();
    const afterNames = after.map((c: Chicken) => c.name);
    expect(afterNames).toContain("Cluck Norris");
    expect(afterNames).toContain("Egg Sheeran");
  }, 15000);

  it("rejects duplicate names", async () => {
    await createChicken({ name: "Dup Test", sex: "Hen" });
    await expect(createChicken({ name: "Dup Test", sex: "Hen" })).rejects.toThrow();
  }, 15000);

  it("trims whitespace from names", async () => {
    const chicken = await createChicken({ name: "  Trimmed Hen  ", sex: "Hen" });
    expect(chicken.name).toBe("Trimmed Hen");
  }, 15000);

  it("sets a chicken as departed and excludes from default list", async () => {
    const chicken = await createChicken({ name: "Departed Bird", sex: "Hen" });
    const updated = await updateChicken(chicken.id, {
      departed: true,
      departure_date: "2026-06-01",
      departure_reason: "sold",
    });
    expect(updated).not.toBeNull();
    expect(updated!.departed).toBe(true);

    const list = await listChickens();
    const names = list.map((c: Chicken) => c.name);
    expect(names).not.toContain("Departed Bird");

    const all = await listChickens(true);
    const allNames = all.map((c: Chicken) => c.name);
    expect(allNames).toContain("Departed Bird");
  }, 15000);
});

describe("Dynamic Lists", () => {
  it("creates and lists breeds", async () => {
    await createValue("breeds", "Leghorn");
    await createValue("breeds", "Australorp");
    const breeds = await listValues("breeds");
    const values = breeds.map((v) => v.value);
    expect(values).toContain("Leghorn");
    expect(values).toContain("Australorp");
  }, 15000);

  it("deduplicates case-insensitively", async () => {
    const id1 = (await createValue("breeds", "Silkie")).id;
    const id2 = (await createValue("breeds", "silkie")).id;
    expect(id1).toBe(id2);
  }, 15000);

  it("renames a value", async () => {
    const entry = await createValue("breeds", "Old Name");
    await renameValue("breeds", entry.id, "New Name");
    const list = await listValues("breeds");
    const values = list.map((v) => v.value);
    expect(values).toContain("New Name");
    expect(values).not.toContain("Old Name");
  }, 15000);

  it("merges values and re-points chickens", async () => {
    const a = await createValue("origin_sources", "Merge Source");
    const b = await createValue("origin_sources", "Merge Target");

    const chicken = await createChicken({
      name: "Merge Test Chicken",
      sex: "Hen",
      origin_source: "Merge Source",
    });

    await mergeValues("origin_sources", a.id, b.id);

    const updated = await listChickens();
    const match = updated.find((c: Chicken) => c.id === chicken.id);
    expect(match).toBeDefined();
    expect(match!.origin_source_name).toBe("Merge Target");

    const list = await listValues("origin_sources");
    expect(list.find((v) => v.id === a.id)).toBeUndefined();
  }, 15000);

  it("refuses to remove a value that is in use", async () => {
    const entry = await createValue("origin_sources", "In Use Source");
    await createChicken({ name: "In Use Test", sex: "Hen", origin_source: "In Use Source" });
    await expect(removeValue("origin_sources", entry.id)).rejects.toThrow("in use");
  }, 15000);

  it("removes an unused value", async () => {
    const entry = await createValue("origin_sources", "Unused Source");
    await removeValue("origin_sources", entry.id);
    const list = await listValues("origin_sources");
    expect(list.find((v) => v.id === entry.id)).toBeUndefined();
  }, 15000);
});
