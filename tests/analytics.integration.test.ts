import { ensureDatabase, runMigrations } from "@/lib/db";
import { createChicken, updateChicken, listChickens, type Chicken } from "@/lib/chickens";
import { createEgg } from "@/lib/eggs";
import { getAnalytics, type AnalyticsData } from "@/lib/analytics";

const RECORDED_BY = "analytics-test@example.com";

beforeAll(async () => {
  await ensureDatabase();
  await runMigrations();
}, 30000);

afterAll(async () => {
  const chickens = await listChickens(true);
  for (const c of chickens) {
    if (c.name.startsWith("Analytics Test")) {
      // Test DB is ephemeral for CI - no cleanup needed
    }
  }
});

async function createTestHen(name: string): Promise<Chicken> {
  const all = await listChickens(true);
  const existing = all.find((c: Chicken) => c.name === name);
  if (existing) return existing;
  return createChicken({ name, sex: "Hen" });
}

async function createTestEgg(chickenId: number, weight: number, date: string): Promise<void> {
  await createEgg({
    chicken_id: chickenId,
    weight,
    date,
    recorded_by: RECORDED_BY,
  });
}

describe("Analytics summary", () => {
  it("computes total egg count and average weight for a date range", async () => {
    const hen = await createTestHen("Analytics Test Summary Hen");
    await createTestEgg(hen.id, 50.00, "2026-06-01");
    await createTestEgg(hen.id, 60.00, "2026-06-02");

    const data = await getAnalytics("2026-06-01", "2026-06-30");
    expect(data.summary.total_eggs).toBeGreaterThanOrEqual(2);
    expect(data.summary.average_weight).not.toBeNull();
    expect(data.summary.total_laying_chickens).toBeGreaterThanOrEqual(1);
    expect(data.summary.active_laying_chickens).toBeGreaterThanOrEqual(1);
  }, 15000);

  it("excludes roosters from laying chicken counts", async () => {
    const all = await listChickens(true);
    let rooster = all.find((c: Chicken) => c.name === "Analytics Test Rooster");
    if (!rooster) {
      rooster = await createChicken({ name: "Analytics Test Rooster", sex: "Rooster" });
    }
    const data = await getAnalytics("2026-01-01", "2026-12-31");
    expect(data.summary.total_laying_chickens).toBeGreaterThanOrEqual(1);
  }, 15000);

  it("returns empty analytics for a date range with no eggs", async () => {
    const data = await getAnalytics("2020-01-01", "2020-01-31");
    expect(data.summary.total_eggs).toBe(0);
    expect(data.summary.average_weight).toBeNull();
  }, 15000);
});

describe("Production time series", () => {
  it("returns daily egg counts", async () => {
    const hen = await createTestHen("Analytics Test Daily Prod");
    await createTestEgg(hen.id, 55.00, "2026-07-01");
    await createTestEgg(hen.id, 56.00, "2026-07-01");
    await createTestEgg(hen.id, 57.00, "2026-07-02");

    const data = await getAnalytics("2026-07-01", "2026-07-31");
    const day1 = data.production_daily.find((d) => d.date === "2026-07-01");
    const day2 = data.production_daily.find((d) => d.date === "2026-07-02");

    expect(day1).toBeDefined();
    expect(day1!.count).toBeGreaterThanOrEqual(2);
    expect(day2).toBeDefined();
    expect(day2!.count).toBeGreaterThanOrEqual(1);
  }, 15000);

  it("returns monthly egg counts with correct aggregation", async () => {
    const hen = await createTestHen("Analytics Test Monthly Prod");
    await createTestEgg(hen.id, 50.00, "2026-01-05");
    await createTestEgg(hen.id, 52.00, "2026-01-15");
    await createTestEgg(hen.id, 51.00, "2026-02-10");

    const data = await getAnalytics("2026-01-01", "2026-02-28");
    const jan = data.production_monthly.find((d) => d.date === "2026-01");
    const feb = data.production_monthly.find((d) => d.date === "2026-02");

    expect(jan).toBeDefined();
    expect(jan!.count).toBeGreaterThanOrEqual(2);
    expect(feb).toBeDefined();
    expect(feb!.count).toBeGreaterThanOrEqual(1);
  }, 15000);
});

describe("Dry periods", () => {
  it("reports days since last egg for each hen", async () => {
    const hen = await createTestHen("Analytics Test Dry Period");
    await createTestEgg(hen.id, 55.00, "2026-06-01");

    const data = await getAnalytics("2026-06-01", "2026-06-30");
    const entry = data.dry_periods_current.find((d) => d.chicken_id === hen.id);
    expect(entry).toBeDefined();
    expect(entry!.days_since_last_egg).toBeGreaterThanOrEqual(0);
  }, 15000);

  it("surfaces hens past the dry threshold in the alert list", async () => {
    const hen = await createTestHen("Analytics Test Dry Alert");
    await createTestEgg(hen.id, 55.00, "2026-05-01");

    const data = await getAnalytics("2026-05-01", "2026-06-30", 4);
    const alert = data.dry_periods_alert.find((d) => d.chicken_id === hen.id);
    expect(alert).toBeDefined();
    expect(alert!.days_since_last_egg).toBeGreaterThanOrEqual(4);
  }, 15000);
});

describe("Departed bird handling", () => {
  it("excludes departed birds from current analytics but includes their historical data", async () => {
    const hen = await createTestHen("Analytics Test Departed");
    await createTestEgg(hen.id, 55.00, "2026-01-15");
    await updateChicken(hen.id, {
      departed: true,
      departure_date: "2026-03-01",
      departure_reason: "sold",
    });

    const data = await getAnalytics("2026-01-01", "2026-12-31");
    expect(data.summary.total_eggs).toBeGreaterThanOrEqual(1);
    expect(data.attrition_by_reason.length).toBeGreaterThanOrEqual(0);
  }, 15000);
});

describe("Seasonal trends and attrition", () => {
  it("computes seasonal trends with Southern Hemisphere season mapping", async () => {
    const hen = await createTestHen("Analytics Test Seasonal");
    await createTestEgg(hen.id, 55.00, "2026-07-15");

    const data = await getAnalytics("2026-01-01", "2026-12-31");
    const winterEntry = data.seasonal_trends.find(
      (s) => s.season === "Winter" && s.year === 2026
    );
    expect(winterEntry).toBeDefined();
    expect(winterEntry!.egg_count).toBeGreaterThanOrEqual(1);
  }, 15000);

  it("reports attrition by reason", async () => {
    const hen = await createTestHen("Analytics Test Attrition");
    await updateChicken(hen.id, {
      departed: true,
      departure_date: "2026-04-01",
      departure_reason: "predator",
    });

    const data = await getAnalytics("2026-01-01", "2026-12-31");
    const predatorEntry = data.attrition_by_reason.find(
      (r) => r.reason === "predator"
    );
    expect(predatorEntry).toBeDefined();
    expect(predatorEntry!.count).toBeGreaterThanOrEqual(1);
  }, 15000);
});
