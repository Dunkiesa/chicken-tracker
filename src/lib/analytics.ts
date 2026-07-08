import sql from "mssql";
import { getPool } from "./db";

export type ProductionTimeSeries = {
  date: string;
  count: number;
};

export type HenWeight = {
  chicken_id: number;
  chicken_name: string;
  avg_weight: number | null;
};

export type HenWeightVariance = {
  chicken_id: number;
  chicken_name: string;
  min_weight: number | null;
  max_weight: number | null;
  std_dev: number | null;
};

export type HenProductivity = {
  chicken_id: number;
  chicken_name: string;
  egg_count: number;
};

export type HenConsistency = {
  chicken_id: number;
  chicken_name: string;
  egg_count: number;
  active_days: number;
  laying_rate: number;
};

export type HenDryPeriod = {
  chicken_id: number;
  chicken_name: string;
  days_since_last_egg: number | null;
};

export type HenLongestStreak = {
  chicken_id: number;
  chicken_name: string;
  longest_streak_days: number | null;
};

export type SeasonalTrend = {
  year: number;
  season: string;
  egg_count: number;
};

export type AttritionByReason = {
  reason: string;
  count: number;
};

export type AnalyticsSummary = {
  total_eggs: number;
  average_weight: number | null;
  total_laying_chickens: number;
  active_laying_chickens: number;
};

export type AnalyticsData = {
  summary: AnalyticsSummary;
  production_daily: ProductionTimeSeries[];
  production_weekly: ProductionTimeSeries[];
  production_monthly: ProductionTimeSeries[];
  average_weight_per_hen: HenWeight[];
  weight_variance_per_hen: HenWeightVariance[];
  most_productive: HenProductivity[];
  production_consistency: HenConsistency[];
  dry_periods_current: HenDryPeriod[];
  dry_periods_longest: HenLongestStreak[];
  dry_periods_alert: HenDryPeriod[];
  seasonal_trends: SeasonalTrend[];
  attrition_by_reason: AttritionByReason[];
  attrition_rate: number | null;
  date_range: { from: string; to: string };
  dry_threshold_days: number;
};

function seasonForMonth(m: number): string {
  if (m === 12 || m === 1 || m === 2) return "Summer";
  if (m === 3 || m === 4 || m === 5) return "Autumn";
  if (m === 6 || m === 7 || m === 8) return "Winter";
  return "Spring";
}

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setFullYear(from.getFullYear() - 1);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  return { from: fmt(from), to: fmt(to) };
}

async function getSummary(
  pool: sql.ConnectionPool,
  from: string,
  to: string
): Promise<AnalyticsSummary> {
  const result = await pool
    .request()
    .input("from", sql.Date, from)
    .input("to", sql.Date, to)
    .query(`
      SELECT
        COUNT(e.id) AS total_eggs,
        AVG(CAST(e.weight AS DECIMAL(10,4))) AS average_weight,
        (SELECT COUNT(*) FROM chickens WHERE sex IN ('Hen', 'Unknown')) AS total_laying_chickens,
        (SELECT COUNT(*) FROM chickens WHERE sex IN ('Hen', 'Unknown') AND departed = 0) AS active_laying_chickens
      FROM eggs e
      JOIN chickens c ON e.chicken_id = c.id
      WHERE c.sex IN ('Hen', 'Unknown')
        AND e.date >= @from AND e.date <= @to
        AND (c.departed = 0 OR e.date <= c.departure_date)
    `);

  const row = result.recordset[0];
  return {
    total_eggs: row.total_eggs ?? 0,
    average_weight: row.average_weight != null ? parseFloat(row.average_weight) : null,
    total_laying_chickens: row.total_laying_chickens ?? 0,
    active_laying_chickens: row.active_laying_chickens ?? 0,
  };
}

async function getProductionDaily(
  pool: sql.ConnectionPool,
  from: string,
  to: string
): Promise<ProductionTimeSeries[]> {
  const result = await pool
    .request()
    .input("from", sql.Date, from)
    .input("to", sql.Date, to)
    .query(`
      SELECT CONVERT(varchar, e.date, 23) AS date, COUNT(*) AS count
      FROM eggs e
      JOIN chickens c ON e.chicken_id = c.id
      WHERE c.sex IN ('Hen', 'Unknown')
        AND e.date >= @from AND e.date <= @to
        AND (c.departed = 0 OR e.date <= c.departure_date)
      GROUP BY e.date
      ORDER BY e.date
    `);

  return result.recordset.map((r) => ({
    date: r.date,
    count: r.count,
  }));
}

async function getProductionWeekly(
  pool: sql.ConnectionPool,
  from: string,
  to: string
): Promise<ProductionTimeSeries[]> {
  const result = await pool
    .request()
    .input("from", sql.Date, from)
    .input("to", sql.Date, to)
    .query(`
      SELECT
        CONVERT(varchar, DATEADD(WEEK, DATEDIFF(WEEK, 0, e.date), 0), 23) AS date,
        COUNT(*) AS count
      FROM eggs e
      JOIN chickens c ON e.chicken_id = c.id
      WHERE c.sex IN ('Hen', 'Unknown')
        AND e.date >= @from AND e.date <= @to
        AND (c.departed = 0 OR e.date <= c.departure_date)
      GROUP BY DATEADD(WEEK, DATEDIFF(WEEK, 0, e.date), 0)
      ORDER BY DATEADD(WEEK, DATEDIFF(WEEK, 0, e.date), 0)
    `);

  return result.recordset.map((r) => ({
    date: r.date,
    count: r.count,
  }));
}

async function getProductionMonthly(
  pool: sql.ConnectionPool,
  from: string,
  to: string
): Promise<ProductionTimeSeries[]> {
  const result = await pool
    .request()
    .input("from", sql.Date, from)
    .input("to", sql.Date, to)
    .query(`
      SELECT
        YEAR(e.date) AS year,
        MONTH(e.date) AS month,
        COUNT(*) AS count
      FROM eggs e
      JOIN chickens c ON e.chicken_id = c.id
      WHERE c.sex IN ('Hen', 'Unknown')
        AND e.date >= @from AND e.date <= @to
        AND (c.departed = 0 OR e.date <= c.departure_date)
      GROUP BY YEAR(e.date), MONTH(e.date)
      ORDER BY YEAR(e.date), MONTH(e.date)
    `);

  return result.recordset.map((r) => {
    const m = String(r.month).padStart(2, "0");
    return { date: `${r.year}-${m}`, count: r.count };
  });
}

async function getAverageWeightPerHen(
  pool: sql.ConnectionPool,
  from: string,
  to: string
): Promise<HenWeight[]> {
  const result = await pool
    .request()
    .input("from", sql.Date, from)
    .input("to", sql.Date, to)
    .query(`
      SELECT
        c.id AS chicken_id,
        c.name AS chicken_name,
        AVG(CAST(e.weight AS DECIMAL(10,4))) AS avg_weight
      FROM chickens c
      LEFT JOIN eggs e ON c.id = e.chicken_id
        AND e.date >= @from AND e.date <= @to
        AND (c.departed = 0 OR e.date <= c.departure_date)
      WHERE c.sex IN ('Hen', 'Unknown')
      GROUP BY c.id, c.name
      ORDER BY c.name
    `);

  return result.recordset.map((r) => ({
    chicken_id: r.chicken_id,
    chicken_name: r.chicken_name,
    avg_weight: r.avg_weight != null ? parseFloat(r.avg_weight) : null,
  }));
}

async function getWeightVariancePerHen(
  pool: sql.ConnectionPool,
  from: string,
  to: string
): Promise<HenWeightVariance[]> {
  const result = await pool
    .request()
    .input("from", sql.Date, from)
    .input("to", sql.Date, to)
    .query(`
      SELECT
        c.id AS chicken_id,
        c.name AS chicken_name,
        MIN(e.weight) AS min_weight,
        MAX(e.weight) AS max_weight,
        STDEV(e.weight) AS std_dev
      FROM chickens c
      LEFT JOIN eggs e ON c.id = e.chicken_id
        AND e.date >= @from AND e.date <= @to
        AND (c.departed = 0 OR e.date <= c.departure_date)
      WHERE c.sex IN ('Hen', 'Unknown')
      GROUP BY c.id, c.name
      ORDER BY c.name
    `);

  return result.recordset.map((r) => ({
    chicken_id: r.chicken_id,
    chicken_name: r.chicken_name,
    min_weight: r.min_weight != null ? parseFloat(r.min_weight) : null,
    max_weight: r.max_weight != null ? parseFloat(r.max_weight) : null,
    std_dev: r.std_dev != null ? parseFloat(r.std_dev) : null,
  }));
}

async function getMostProductive(
  pool: sql.ConnectionPool,
  from: string,
  to: string
): Promise<HenProductivity[]> {
  const result = await pool
    .request()
    .input("from", sql.Date, from)
    .input("to", sql.Date, to)
    .query(`
      SELECT
        c.id AS chicken_id,
        c.name AS chicken_name,
        COUNT(e.id) AS egg_count
      FROM chickens c
      JOIN eggs e ON c.id = e.chicken_id
        AND e.date >= @from AND e.date <= @to
        AND (c.departed = 0 OR e.date <= c.departure_date)
      WHERE c.sex IN ('Hen', 'Unknown')
      GROUP BY c.id, c.name
      ORDER BY egg_count DESC, c.name
    `);

  return result.recordset.map((r) => ({
    chicken_id: r.chicken_id,
    chicken_name: r.chicken_name,
    egg_count: r.egg_count,
  }));
}

async function getProductionConsistency(
  pool: sql.ConnectionPool,
  from: string,
  to: string
): Promise<HenConsistency[]> {
  const result = await pool
    .request()
    .input("from", sql.Date, from)
    .input("to", sql.Date, to)
    .query(`
      SELECT
        c.id AS chicken_id,
        c.name AS chicken_name,
        COUNT(e.id) AS egg_count,
        DATEDIFF(DAY, @from, @to) + 1 AS window_days,
        CASE
          WHEN c.departed = 1 AND c.departure_date IS NOT NULL AND c.departure_date < @to
            THEN DATEDIFF(DAY,
              CASE WHEN c.created_at > @from THEN c.created_at ELSE @from END,
              c.departure_date
            ) + 1
          ELSE DATEDIFF(DAY,
            CASE WHEN c.created_at > @from THEN c.created_at ELSE @from END,
            @to
          ) + 1
        END AS active_days
      FROM chickens c
      LEFT JOIN eggs e ON c.id = e.chicken_id
        AND e.date >= @from AND e.date <= @to
        AND (c.departed = 0 OR e.date <= c.departure_date)
      WHERE c.sex IN ('Hen', 'Unknown')
      GROUP BY c.id, c.name, c.departed, c.departure_date, c.created_at
      ORDER BY c.name
    `);

  return result.recordset.map((r) => {
    const activeDays = r.active_days > 0 ? r.active_days : 1;
    return {
      chicken_id: r.chicken_id,
      chicken_name: r.chicken_name,
      egg_count: r.egg_count,
      active_days: r.active_days,
      laying_rate: Math.round((r.egg_count / activeDays) * 10000) / 100,
    };
  });
}

async function getDryPeriods(
  pool: sql.ConnectionPool,
  from: string,
  to: string,
  thresholdDays: number
): Promise<{
  current: HenDryPeriod[];
  longest: HenLongestStreak[];
  alert: HenDryPeriod[];
}> {
  const currentResult = await pool
    .request()
    .input("from", sql.Date, from)
    .input("to", sql.Date, to)
    .query(`
      SELECT
        c.id AS chicken_id,
        c.name AS chicken_name,
        DATEDIFF(DAY, MAX(e.date), GETDATE()) AS days_since_last_egg
      FROM chickens c
      LEFT JOIN eggs e ON c.id = e.chicken_id
        AND e.date >= @from AND e.date <= @to
      WHERE c.sex IN ('Hen', 'Unknown') AND c.departed = 0
      GROUP BY c.id, c.name
      ORDER BY c.name
    `);

  const current: HenDryPeriod[] = currentResult.recordset.map((r) => ({
    chicken_id: r.chicken_id,
    chicken_name: r.chicken_name,
    days_since_last_egg: r.days_since_last_egg,
  }));

  const longestResult = await pool
    .request()
    .input("from", sql.Date, from)
    .input("to", sql.Date, to)
    .query(`
      WITH egg_gaps AS (
        SELECT
          chicken_id,
          DATEDIFF(DAY, LAG(date) OVER (PARTITION BY chicken_id ORDER BY date), date) AS gap_days
        FROM eggs
        WHERE date >= @from AND date <= @to
      )
      SELECT
        c.id AS chicken_id,
        c.name AS chicken_name,
        ISNULL(MAX(eg.gap_days), 0) AS longest_streak
      FROM chickens c
      LEFT JOIN egg_gaps eg ON c.id = eg.chicken_id
      WHERE c.sex IN ('Hen', 'Unknown') AND c.departed = 0
      GROUP BY c.id, c.name
      ORDER BY c.name
    `);

  const longest: HenLongestStreak[] = longestResult.recordset.map((r) => ({
    chicken_id: r.chicken_id,
    chicken_name: r.chicken_name,
    longest_streak_days: r.longest_streak != null ? r.longest_streak : null,
  }));

  const alert = current.filter(
    (c) => c.days_since_last_egg != null && c.days_since_last_egg >= thresholdDays
  );

  return { current, longest, alert };
}

async function getSeasonalTrends(
  pool: sql.ConnectionPool,
  from: string,
  to: string
): Promise<SeasonalTrend[]> {
  const result = await pool
    .request()
    .input("from", sql.Date, from)
    .input("to", sql.Date, to)
    .query(`
      SELECT
        YEAR(e.date) AS year,
        MONTH(e.date) AS month,
        COUNT(*) AS egg_count
      FROM eggs e
      JOIN chickens c ON e.chicken_id = c.id
      WHERE c.sex IN ('Hen', 'Unknown')
        AND e.date >= @from AND e.date <= @to
        AND (c.departed = 0 OR e.date <= c.departure_date)
      GROUP BY YEAR(e.date), MONTH(e.date)
      ORDER BY YEAR(e.date), MONTH(e.date)
    `);

  const seasonOrder: Record<string, number> = { Summer: 0, Autumn: 1, Winter: 2, Spring: 3 };
  const aggregated = new Map<string, SeasonalTrend>();
  for (const r of result.recordset) {
    const season = seasonForMonth(r.month);
    const key = `${r.year}-${season}`;
    if (aggregated.has(key)) {
      aggregated.get(key)!.egg_count += r.egg_count;
    } else {
      aggregated.set(key, { year: r.year, season, egg_count: r.egg_count });
    }
  }
  return Array.from(aggregated.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return seasonOrder[a.season] - seasonOrder[b.season];
  });
}

async function getAttrition(
  pool: sql.ConnectionPool,
  from: string,
  to: string
): Promise<{ byReason: AttritionByReason[]; rate: number | null }> {
  const reasonResult = await pool
    .request()
    .input("from", sql.Date, from)
    .input("to", sql.Date, to)
    .query(`
      SELECT
        ISNULL(departure_reason, 'Unknown') AS reason,
        COUNT(*) AS count
      FROM chickens
      WHERE sex IN ('Hen', 'Unknown')
        AND departed = 1
        AND departure_date >= @from
        AND departure_date <= @to
      GROUP BY departure_reason
      ORDER BY count DESC
    `);

  const byReason: AttritionByReason[] = reasonResult.recordset.map((r) => ({
    reason: r.reason,
    count: r.count,
  }));

  const countResult = await pool
    .request()
    .query(`
      SELECT COUNT(*) AS total
      FROM chickens
      WHERE sex IN ('Hen', 'Unknown')
    `);

  const total = countResult.recordset[0].total;
  const departedCount = byReason.reduce((sum, r) => sum + r.count, 0);
  const rate = total > 0 ? Math.round((departedCount / total) * 10000) / 100 : null;

  return { byReason, rate };
}

export async function getAnalytics(
  dateFrom?: string,
  dateTo?: string,
  dryThresholdDays = 4
): Promise<AnalyticsData> {
  const pool = await getPool();
  const { from, to } = dateFrom && dateTo ? { from: dateFrom, to: dateTo } : defaultDateRange();
  const threshold = dryThresholdDays > 0 ? dryThresholdDays : 4;

  const [
    summary,
    productionDaily,
    productionWeekly,
    productionMonthly,
    averageWeightPerHen,
    weightVariancePerHen,
    mostProductive,
    productionConsistency,
    dryPeriods,
    seasonalTrends,
    attrition,
  ] = await Promise.all([
    getSummary(pool, from, to),
    getProductionDaily(pool, from, to),
    getProductionWeekly(pool, from, to),
    getProductionMonthly(pool, from, to),
    getAverageWeightPerHen(pool, from, to),
    getWeightVariancePerHen(pool, from, to),
    getMostProductive(pool, from, to),
    getProductionConsistency(pool, from, to),
    getDryPeriods(pool, from, to, threshold),
    getSeasonalTrends(pool, from, to),
    getAttrition(pool, from, to),
  ]);

  return {
    summary,
    production_daily: productionDaily,
    production_weekly: productionWeekly,
    production_monthly: productionMonthly,
    average_weight_per_hen: averageWeightPerHen,
    weight_variance_per_hen: weightVariancePerHen,
    most_productive: mostProductive,
    production_consistency: productionConsistency,
    dry_periods_current: dryPeriods.current,
    dry_periods_longest: dryPeriods.longest,
    dry_periods_alert: dryPeriods.alert,
    seasonal_trends: seasonalTrends,
    attrition_by_reason: attrition.byReason,
    attrition_rate: attrition.rate,
    date_range: { from, to },
    dry_threshold_days: threshold,
  };
}
