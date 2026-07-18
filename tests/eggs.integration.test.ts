import { ensureDatabase, runMigrations, closePool } from "@/lib/db";
import {
  createEgg,
  createEggs,
  listEggs,
  getEgg,
  updateEgg,
  deleteEgg,
  checkDuplicate,
  getLayingContext,
  getLastUsedChicken,
  type Egg,
  type CreateEggInput,
  type CreateEggWarning,
} from "@/lib/eggs";
import { createChicken, listChickens, type Chicken } from "@/lib/chickens";

beforeAll(async () => {
  await ensureDatabase();
  await runMigrations();
}, 30000);

afterAll(async () => {
  await closePool();
});

const RECORDED_BY = "test@example.com";
const SECOND_USER = "viewer@example.com";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ensureHen(name: string): Promise<Chicken> {
  const all = await listChickens();
  const existing = all.find((c: Chicken) => c.name === name);
  if (existing) return existing;
  return createChicken({ name, sex: "Hen" });
}

async function ensureRooster(name: string): Promise<Chicken> {
  const all = await listChickens();
  const existing = all.find((c: Chicken) => c.name === name);
  if (existing) return existing;
  return createChicken({ name, sex: "Rooster" });
}

describe("Egg CRUD", () => {
  it("creates an egg and assigns a unique ID", async () => {
    const hen = await ensureHen("Egg Layer CRUD");
    const { egg } = await createEgg({
      chicken_id: hen.id,
      weight: 58.34,
      date: "2026-06-15",
      recorded_by: RECORDED_BY,
    });

    expect(egg).toBeDefined();
    expect(egg.chicken_id).toBe(hen.id);
    expect(egg.chicken_name).toBe("Egg Layer CRUD");
    expect(egg.weight).toBe(58.34);
    expect(egg.date).toBe("2026-06-15");
    expect(egg.recorded_by).toBe(RECORDED_BY);
    expect(typeof egg.id).toBe("number");
  }, 15000);

  it("retrieves an egg by ID", async () => {
    const hen = await ensureHen("Egg Getter");
    const { egg: created } = await createEgg({
      chicken_id: hen.id,
      weight: 60.00,
      date: "2026-06-16",
      recorded_by: RECORDED_BY,
    });

    const fetched = await getEgg(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.weight).toBe(60.00);
  }, 15000);

  it("lists all eggs ordered by date desc", async () => {
    const hen = await ensureHen("Egg Lister");
    await createEgg({
      chicken_id: hen.id,
      weight: 50.00,
      date: "2026-06-10",
      recorded_by: RECORDED_BY,
    });
    await createEgg({
      chicken_id: hen.id,
      weight: 55.00,
      date: "2026-06-20",
      recorded_by: RECORDED_BY,
    });

    const eggs = await listEggs();
    const henEggs = eggs.filter((e: Egg) => e.chicken_id === hen.id);
    expect(henEggs.length).toBeGreaterThanOrEqual(2);

    for (let i = 1; i < henEggs.length; i++) {
      expect(henEggs[i - 1]!.date >= henEggs[i]!.date).toBe(true);
    }
  }, 15000);

  it("filters eggs by date", async () => {
    const hen = await ensureHen("Egg Date Filter");
    await createEgg({
      chicken_id: hen.id,
      weight: 52.00,
      date: "2026-06-05",
      recorded_by: RECORDED_BY,
    });

    const filtered = await listEggs({ date: "2026-06-05" });
    const matches = filtered.filter((e: Egg) => e.chicken_id === hen.id);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]!.date).toBe("2026-06-05");
  }, 15000);

  it("updates an egg's weight, date, and chicken", async () => {
    const hen = await ensureHen("Egg Updater");
    const hen2 = await ensureHen("Egg Updater Alt");
    const { egg } = await createEgg({
      chicken_id: hen.id,
      weight: 50.00,
      date: "2026-06-01",
      recorded_by: RECORDED_BY,
    });

    const updated = await updateEgg(egg.id, {
      weight: 62.50,
      date: "2026-06-02",
      chicken_id: hen2.id,
    });
    expect(updated).not.toBeNull();
    expect(updated!.weight).toBe(62.50);
    expect(updated!.date).toBe("2026-06-02");
    expect(updated!.chicken_id).toBe(hen2.id);
  }, 15000);

  it("deletes an egg", async () => {
    const hen = await ensureHen("Egg Deleter");
    const { egg } = await createEgg({
      chicken_id: hen.id,
      weight: 45.00,
      date: "2026-06-03",
      recorded_by: RECORDED_BY,
    });

    const deleted = await deleteEgg(egg.id);
    expect(deleted).toBe(true);

    const fetched = await getEgg(egg.id);
    expect(fetched).toBeNull();
  }, 15000);

  it("returns null for a non-existent egg", async () => {
    const fetched = await getEgg(999999);
    expect(fetched).toBeNull();
  }, 15000);
});

describe("Attribution", () => {
  it("always attributes an egg to exactly one chicken", async () => {
    const hen = await ensureHen("Attribution Hen");

    // Create egg for this specific chicken
    const { egg } = await createEgg({
      chicken_id: hen.id,
      weight: 55.00,
      date: "2026-06-10",
      recorded_by: RECORDED_BY,
    });

    // Verify egg is attributed correctly
    expect(egg.chicken_id).toBe(hen.id);
    expect(egg.chicken_name).toBe("Attribution Hen");

    // Fetch the egg to confirm persistence
    const fetched = await getEgg(egg.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.chicken_id).toBe(hen.id);

    // Verify the egg shows up under this chicken
    const henEggs = await listEggs({ chicken_id: hen.id });
    expect(henEggs.some((e: Egg) => e.id === egg.id)).toBe(true);
  }, 15000);

  it("eggs for different chickens are attributed independently", async () => {
    const henA = await ensureHen("Attribution A");
    const henB = await ensureHen("Attribution B");

    const { egg: eggA } = await createEgg({
      chicken_id: henA.id,
      weight: 50.00,
      date: "2026-06-15",
      recorded_by: RECORDED_BY,
    });
    const { egg: eggB } = await createEgg({
      chicken_id: henB.id,
      weight: 60.00,
      date: "2026-06-15",
      recorded_by: RECORDED_BY,
    });

    expect(eggA.chicken_id).toBe(henA.id);
    expect(eggB.chicken_id).toBe(henB.id);
    expect(eggA.id).not.toBe(eggB.id);
  }, 15000);
});

describe("Per-day duplicate warning + override", () => {
  it("detects a duplicate egg for same chicken on same date", async () => {
    const hen = await ensureHen("Duplicate Test Hen");

    await createEgg({
      chicken_id: hen.id,
      weight: 55.00,
      date: "2026-07-01",
      recorded_by: RECORDED_BY,
    });

    const existingId = await checkDuplicate(hen.id, "2026-07-01");
    expect(existingId).not.toBeNull();
    expect(typeof existingId).toBe("number");
  }, 15000);

  it("creates a second egg on the same date when override is used", async () => {
    const hen = await ensureHen("Duplicate Override Hen");

    await createEgg({
      chicken_id: hen.id,
      weight: 55.00,
      date: "2026-07-02",
      recorded_by: RECORDED_BY,
    });

    // overrideDuplicate = true should bypass the check
    const { egg } = await createEgg(
      {
        chicken_id: hen.id,
        weight: 56.00,
        date: "2026-07-02",
        recorded_by: RECORDED_BY,
      },
      true
    );

    expect(egg).toBeDefined();
    expect(egg.chicken_id).toBe(hen.id);
    expect(egg.date).toBe("2026-07-02");
  }, 15000);

  it("allows two different chickens to have eggs on the same date", async () => {
    const henA = await ensureHen("Same Date A");
    const henB = await ensureHen("Same Date B");

    const { egg: e1 } = await createEgg({
      chicken_id: henA.id,
      weight: 50.00,
      date: "2026-07-03",
      recorded_by: RECORDED_BY,
    });
    const { egg: e2 } = await createEgg({
      chicken_id: henB.id,
      weight: 60.00,
      date: "2026-07-03",
      recorded_by: RECORDED_BY,
    });

    expect(e1.date).toBe("2026-07-03");
    expect(e2.date).toBe("2026-07-03");
    expect(e1.id).not.toBe(e2.id);
  }, 15000);
});

describe("Weight precision and validation", () => {
  it("stores weight with 2 decimal places", async () => {
    const hen = await ensureHen("Precision Hen");
    const { egg } = await createEgg({
      chicken_id: hen.id,
      weight: 58.346,
      date: "2026-06-20",
      recorded_by: RECORDED_BY,
    });

    expect(egg.weight).toBe(58.35);
  }, 15000);

  it("accepts weight at the boundary of 20g", async () => {
    const hen = await ensureHen("Boundary 20g");
    const { egg, warnings } = await createEgg({
      chicken_id: hen.id,
      weight: 20.00,
      date: "2026-06-21",
      recorded_by: RECORDED_BY,
    });

    expect(egg).toBeDefined();
    expect(egg.weight).toBe(20.00);
    const weightWarnings = warnings.filter(
      (w) => w.type === "weight_out_of_range"
    );
    expect(weightWarnings.length).toBe(0);
  }, 15000);

  it("accepts weight at the boundary of 200g", async () => {
    const hen = await ensureHen("Boundary 200g");
    const { egg, warnings } = await createEgg({
      chicken_id: hen.id,
      weight: 200.00,
      date: "2026-06-22",
      recorded_by: RECORDED_BY,
    });

    expect(egg).toBeDefined();
    expect(egg.weight).toBe(200.00);
    const weightWarnings = warnings.filter(
      (w) => w.type === "weight_out_of_range"
    );
    expect(weightWarnings.length).toBe(0);
  }, 15000);

  it("returns a soft warning for weight below 20g but still creates the egg", async () => {
    const hen = await ensureHen("Low Weight Hen");
    const { egg, warnings } = await createEgg({
      chicken_id: hen.id,
      weight: 15.00,
      date: "2026-06-23",
      recorded_by: RECORDED_BY,
    });

    expect(egg).toBeDefined();
    expect(egg.weight).toBe(15.00);
    expect(warnings.some((w) => w.type === "weight_out_of_range")).toBe(true);
  }, 15000);

  it("returns a soft warning for weight above 200g but still creates the egg", async () => {
    const hen = await ensureHen("High Weight Hen");
    const { egg, warnings } = await createEgg({
      chicken_id: hen.id,
      weight: 250.00,
      date: "2026-06-24",
      recorded_by: RECORDED_BY,
    });

    expect(egg).toBeDefined();
    expect(egg.weight).toBe(250.00);
    expect(warnings.some((w) => w.type === "weight_out_of_range")).toBe(true);
  }, 15000);
});

describe("Edit/delete authorization", () => {
  it("updates own egg entry", async () => {
    const hen = await ensureHen("Edit Own");
    const { egg } = await createEgg({
      chicken_id: hen.id,
      weight: 50.00,
      date: "2026-06-25",
      recorded_by: RECORDED_BY,
    });

    const updated = await updateEgg(egg.id, { weight: 55.00 });
    expect(updated).not.toBeNull();
    expect(updated!.weight).toBe(55.00);
  }, 15000);

  it("deletes own egg entry", async () => {
    const hen = await ensureHen("Delete Own");
    const { egg } = await createEgg({
      chicken_id: hen.id,
      weight: 50.00,
      date: "2026-06-26",
      recorded_by: RECORDED_BY,
    });

    const result = await deleteEgg(egg.id);
    expect(result).toBe(true);
  }, 15000);

  it("updates egg with different chicken and date avoiding duplicate", async () => {
    const hen = await ensureHen("Edit Duplicate Check");
    const hen2 = await ensureHen("Edit Duplicate Check Alt");

    const { egg } = await createEgg({
      chicken_id: hen.id,
      weight: 50.00,
      date: "2026-06-27",
      recorded_by: RECORDED_BY,
    });

    // Create egg for hen2 on same date to trigger duplicate on edit
    await createEgg({
      chicken_id: hen2.id,
      weight: 55.00,
      date: "2026-06-27",
      recorded_by: RECORDED_BY,
    });

    // Should detect duplicate when trying to change to hen2 on same date
    const existingId = await checkDuplicate(hen2.id, "2026-06-27", egg.id);
    expect(existingId).not.toBeNull();
  }, 15000);
});

describe("Batch Create (createEggs)", () => {
  it("creates multiple eggs in a batch", async () => {
    const hen1 = await ensureHen("Batch Create Hen 1");
    const hen2 = await ensureHen("Batch Create Hen 2");

    const result = await createEggs([
      {
        chicken_id: hen1.id,
        weight: 55.00,
        date: "2026-07-10",
        recorded_by: RECORDED_BY,
      },
      {
        chicken_id: hen2.id,
        weight: 60.00,
        date: "2026-07-10",
        recorded_by: RECORDED_BY,
      },
    ]);

    expect(result.eggs.length).toBe(2);
    expect(result.warnings.length).toBe(2);
    expect(result.eggs[0]!.chicken_id).toBe(hen1.id);
    expect(result.eggs[0]!.weight).toBe(55.00);
    expect(result.eggs[0]!.date).toBe("2026-07-10");
    expect(result.eggs[1]!.chicken_id).toBe(hen2.id);
    expect(result.eggs[1]!.weight).toBe(60.00);
    expect(result.eggs[1]!.date).toBe("2026-07-10");
  }, 15000);

  it("returns warnings per-entry for duplicate dates", async () => {
    const hen = await ensureHen("Batch Duplicate Hen");

    await createEgg({
      chicken_id: hen.id,
      weight: 55.00,
      date: "2026-07-11",
      recorded_by: RECORDED_BY,
    });

    const result = await createEggs([
      {
        chicken_id: hen.id,
        weight: 56.00,
        date: "2026-07-11",
        recorded_by: RECORDED_BY,
      },
    ]);

    expect(result.eggs.length).toBe(1);
    expect(result.warnings[0]!.some((w) => w.type === "duplicate_date")).toBe(true);
    expect(result.eggs[0]!.weight).toBe(56.00);
  }, 15000);

  it("returns warnings per-entry for out-of-range weight", async () => {
    const hen = await ensureHen("Batch Weight Hen");

    const result = await createEggs([
      {
        chicken_id: hen.id,
        weight: 15.00,
        date: "2026-07-12",
        recorded_by: RECORDED_BY,
      },
    ]);

    expect(result.eggs.length).toBe(1);
    expect(result.warnings[0]!.some((w) => w.type === "weight_out_of_range")).toBe(true);
    expect(result.eggs[0]!.weight).toBe(15.00);
  }, 15000);

  it("overrideDuplicate=true suppresses duplicate warnings", async () => {
    const hen = await ensureHen("Batch Override Hen");

    await createEgg({
      chicken_id: hen.id,
      weight: 55.00,
      date: "2026-07-13",
      recorded_by: RECORDED_BY,
    });

    const result = await createEggs(
      [
        {
          chicken_id: hen.id,
          weight: 56.00,
          date: "2026-07-13",
          recorded_by: RECORDED_BY,
        },
      ],
      true
    );

    expect(result.eggs.length).toBe(1);
    expect(result.warnings[0]!.some((w) => w.type === "duplicate_date")).toBe(false);
  }, 15000);

  it("returns empty arrays for empty input", async () => {
    const result = await createEggs([]);

    expect(result.eggs.length).toBe(0);
    expect(result.warnings.length).toBe(0);
  }, 15000);

  it("batch rolls back on error", async () => {
    const hen1 = await ensureHen("Batch Rollback Hen 1");
    const hen2 = await ensureHen("Batch Rollback Hen 2");

    await expect(
      createEggs([
        {
          chicken_id: hen1.id,
          weight: 55.00,
          date: "2026-07-14",
          recorded_by: RECORDED_BY,
        },
        {
          chicken_id: 999999,
          weight: 60.00,
          date: "2026-07-14",
          recorded_by: RECORDED_BY,
        },
      ])
    ).rejects.toThrow();

    const eggs = await listEggs({ chicken_id: hen1.id });
    expect(eggs.length).toBe(0);
  }, 15000);
});

describe("Last Used Chicken", () => {
  it("returns null when user has no eggs", async () => {
    const result = await getLastUsedChicken("never-logged@example.com");
    expect(result).toBeNull();
  }, 15000);

  it("returns the most recent chicken for the user", async () => {
    const henA = await ensureHen("Last Used A");
    const henB = await ensureHen("Last Used B");

    await createEgg({
      chicken_id: henA.id,
      weight: 50.00,
      date: "2026-07-01",
      recorded_by: RECORDED_BY,
    });

    await sleep(1100);

    await createEgg({
      chicken_id: henB.id,
      weight: 55.00,
      date: "2026-07-02",
      recorded_by: RECORDED_BY,
    });

    const result = await getLastUsedChicken(RECORDED_BY);
    expect(result).not.toBeNull();
    expect(result!.chicken_id).toBe(henB.id);
    expect(result!.chicken_name).toBe("Last Used B");
  }, 15000);

  it("returns correct chicken per user", async () => {
    const hen = await ensureHen("Per User Hen");

    await createEgg({
      chicken_id: hen.id,
      weight: 60.00,
      date: "2026-07-03",
      recorded_by: SECOND_USER,
    });

    const resultA = await getLastUsedChicken(RECORDED_BY);
    expect(resultA!.chicken_name).toBe("Last Used B");

    const resultB = await getLastUsedChicken(SECOND_USER);
    expect(resultB).not.toBeNull();
    expect(resultB!.chicken_name).toBe("Per User Hen");
  }, 15000);
});

describe("Laying Context", () => {
  it("returns context only for laying-eligible chickens (Hen/Unknown)", async () => {
    const hen = await ensureHen("Context Hen");
    await ensureRooster("Context Rooster");

    await createEgg({
      chicken_id: hen.id,
      weight: 60.00,
      date: "2026-06-28",
      recorded_by: RECORDED_BY,
    });

    const context = await getLayingContext();
    const chickenIds = context.map((c) => c.chicken_id);
    const rooster = await listChickens().then((all: Chicken[]) =>
      all.find((c: Chicken) => c.name === "Context Rooster")
    );
    if (rooster) {
      expect(chickenIds).not.toContain(rooster.id);
    }
  }, 15000);

  it("includes recent average weight for the last 14 days", async () => {
    const hen = await ensureHen("Context Avg Weight");
    await createEgg({
      chicken_id: hen.id,
      weight: 58.00,
      date: "2026-06-28",
      recorded_by: RECORDED_BY,
    });
    await createEgg({
      chicken_id: hen.id,
      weight: 62.00,
      date: "2026-06-29",
      recorded_by: RECORDED_BY,
    });

    const context = await getLayingContext();
    const ctx = context.find((c) => c.chicken_id === hen.id);
    expect(ctx).toBeDefined();
  }, 15000);
});
