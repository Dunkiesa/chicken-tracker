"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type AnalyticsSummary = {
  total_eggs: number;
  average_weight: number | null;
  total_laying_chickens: number;
  active_laying_chickens: number;
};

type ProductionTimeSeries = {
  date: string;
  count: number;
};

type HenWeight = {
  chicken_id: number;
  chicken_name: string;
  avg_weight: number | null;
};

type HenWeightVariance = {
  chicken_id: number;
  chicken_name: string;
  min_weight: number | null;
  max_weight: number | null;
  std_dev: number | null;
};

type HenProductivity = {
  chicken_id: number;
  chicken_name: string;
  egg_count: number;
};

type HenConsistency = {
  chicken_id: number;
  chicken_name: string;
  egg_count: number;
  active_days: number;
  laying_rate: number;
};

type HenDryPeriod = {
  chicken_id: number;
  chicken_name: string;
  days_since_last_egg: number | null;
};

type HenLongestStreak = {
  chicken_id: number;
  chicken_name: string;
  longest_streak_days: number | null;
};

type SeasonalTrend = {
  year: number;
  month: number;
  season: string;
  egg_count: number;
};

type AttritionByReason = {
  reason: string;
  count: number;
};

type AnalyticsData = {
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

type TimeGranularity = "daily" | "weekly" | "monthly";

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function oneYearAgoStr(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(oneYearAgoStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [granularity, setGranularity] = useState<TimeGranularity>("monthly");

  const fetchAnalytics = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics?from=${from}&to=${to}`);
      if (!res.ok) {
        const body = await res.json();
        setError(body.message || "Failed to load analytics");
        return;
      }
      const json: AnalyticsData = await res.json();
      setData(json);
    } catch {
      setError("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }
    if (status === "authenticated") {
      fetchAnalytics(dateFrom, dateTo);
    }
  }, [status, router, fetchAnalytics, dateFrom, dateTo]);

  function handleRefresh() {
    fetchAnalytics(dateFrom, dateTo);
  }

  if (status === "loading") {
    return (
      <main style={{ padding: "2rem", textAlign: "center", color: "#999" }}>
        Loading...
      </main>
    );
  }

  const productionData =
    data &&
    (granularity === "daily"
      ? data.production_daily
      : granularity === "weekly"
      ? data.production_weekly
      : data.production_monthly);

  const sectionStyle: React.CSSProperties = {
    padding: "1.5rem 2rem",
    borderRadius: "8px",
    border: "1px solid #ddd",
    background: "#fff",
    width: "100%",
    maxWidth: "900px",
  };

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "1rem",
        gap: "1.5rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          maxWidth: "900px",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem" }}>Analytics Dashboard</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ color: "#666", fontSize: "0.875rem" }}>
            {session?.user?.email}
          </span>
          <a
            href="/"
            style={{
              padding: "0.4rem 0.75rem",
              background: "#e0e0e0",
              borderRadius: "4px",
              textDecoration: "none",
              color: "#333",
              fontSize: "0.875rem",
            }}
          >
            Home
          </a>
        </div>
      </div>

      <div
        style={{
          ...sectionStyle,
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label htmlFor="from" style={{ fontWeight: 600, fontSize: "0.875rem", whiteSpace: "nowrap" }}>
            From
          </label>
          <input
            id="from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              padding: "0.4rem",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "0.875rem",
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label htmlFor="to" style={{ fontWeight: 600, fontSize: "0.875rem", whiteSpace: "nowrap" }}>
            To
          </label>
          <input
            id="to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              padding: "0.4rem",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "0.875rem",
            }}
          />
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          style={{
            padding: "0.4rem 1rem",
            background: "#1565c0",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.875rem",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div
          style={{
            ...sectionStyle,
            color: "#d32f2f",
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "1rem",
              width: "100%",
              maxWidth: "900px",
            }}
          >
            {[
              { label: "Total Eggs", value: data.summary.total_eggs, color: "#2e7d32" },
              {
                label: "Avg Weight",
                value: data.summary.average_weight != null ? `${data.summary.average_weight.toFixed(1)}g` : "-",
                color: "#1565c0",
              },
              { label: "Active Hens", value: data.summary.active_laying_chickens, color: "#e65100" },
              { label: "Total Hens", value: data.summary.total_laying_chickens, color: "#6a1b9a" },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  padding: "1.25rem",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                  background: "#fff",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {card.label}
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 700, color: card.color, marginTop: "0.25rem" }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          {/* Production Over Time */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <h2 style={{ fontSize: "1.125rem" }}>Production Over Time</h2>
              <div style={{ display: "flex", gap: "0.25rem" }}>
                {(["daily", "weekly", "monthly"] as TimeGranularity[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGranularity(g)}
                    style={{
                      padding: "0.25rem 0.6rem",
                      fontSize: "0.8rem",
                      border: granularity === g ? "2px solid #1565c0" : "1px solid #ccc",
                      borderRadius: "4px",
                      background: granularity === g ? "#e3f2fd" : "#fff",
                      color: granularity === g ? "#1565c0" : "#333",
                      fontWeight: granularity === g ? 600 : 400,
                      cursor: "pointer",
                    }}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {productionData && productionData.length === 0 ? (
              <p style={{ color: "#999", fontSize: "0.9rem" }}>No eggs logged in this period.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #eee" }}>
                      <th style={{ textAlign: "left", padding: "0.4rem 0.4rem 0.4rem 0", fontWeight: 600 }}>Period</th>
                      <th style={{ textAlign: "right", padding: "0.4rem", fontWeight: 600 }}>Eggs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productionData!.map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "0.4rem 0.4rem 0.4rem 0", color: "#555" }}>{row.date}</td>
                        <td style={{ padding: "0.4rem", textAlign: "right", fontWeight: 600 }}>{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Average Weight per Hen */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: "1.125rem", marginBottom: "1rem" }}>Average Egg Weight</h2>
            {data.average_weight_per_hen.length === 0 ? (
              <p style={{ color: "#999", fontSize: "0.9rem" }}>No data.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #eee" }}>
                      <th style={{ textAlign: "left", padding: "0.4rem 0.4rem 0.4rem 0", fontWeight: 600 }}>Hen</th>
                      <th style={{ textAlign: "right", padding: "0.4rem", fontWeight: 600 }}>Avg Weight (g)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.average_weight_per_hen.map((h) => (
                      <tr key={h.chicken_id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "0.4rem 0.4rem 0.4rem 0" }}>{h.chicken_name}</td>
                        <td style={{ padding: "0.4rem", textAlign: "right" }}>
                          {h.avg_weight != null ? h.avg_weight.toFixed(1) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Weight Variance */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: "1.125rem", marginBottom: "1rem" }}>Egg Weight Variance</h2>
            {data.weight_variance_per_hen.length === 0 ? (
              <p style={{ color: "#999", fontSize: "0.9rem" }}>No data.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #eee" }}>
                      <th style={{ textAlign: "left", padding: "0.4rem 0.4rem 0.4rem 0", fontWeight: 600 }}>Hen</th>
                      <th style={{ textAlign: "right", padding: "0.4rem", fontWeight: 600 }}>Min (g)</th>
                      <th style={{ textAlign: "right", padding: "0.4rem", fontWeight: 600 }}>Max (g)</th>
                      <th style={{ textAlign: "right", padding: "0.4rem", fontWeight: 600 }}>Std Dev</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.weight_variance_per_hen.map((h) => (
                      <tr key={h.chicken_id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "0.4rem 0.4rem 0.4rem 0" }}>{h.chicken_name}</td>
                        <td style={{ padding: "0.4rem", textAlign: "right" }}>
                          {h.min_weight != null ? h.min_weight.toFixed(1) : "-"}
                        </td>
                        <td style={{ padding: "0.4rem", textAlign: "right" }}>
                          {h.max_weight != null ? h.max_weight.toFixed(1) : "-"}
                        </td>
                        <td style={{ padding: "0.4rem", textAlign: "right" }}>
                          {h.std_dev != null ? h.std_dev.toFixed(2) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Most Productive */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: "1.125rem", marginBottom: "1rem" }}>Most Productive Chickens</h2>
            {data.most_productive.length === 0 ? (
              <p style={{ color: "#999", fontSize: "0.9rem" }}>No eggs logged in this period.</p>
            ) : (
              <ol style={{ paddingLeft: "1.25rem", margin: 0 }}>
                {data.most_productive.map((h, i) => (
                  <li
                    key={h.chicken_id}
                    style={{
                      padding: "0.3rem 0",
                      borderBottom: i < data.most_productive.length - 1 ? "1px solid #f0f0f0" : "none",
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{h.chicken_name}</span>
                    <span style={{ color: "#666", marginLeft: "0.5rem" }}>
                      {h.egg_count} egg{h.egg_count !== 1 ? "s" : ""}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Production Consistency */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: "1.125rem", marginBottom: "1rem" }}>Production Consistency (Laying Rate)</h2>
            {data.production_consistency.length === 0 ? (
              <p style={{ color: "#999", fontSize: "0.9rem" }}>No data.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #eee" }}>
                      <th style={{ textAlign: "left", padding: "0.4rem 0.4rem 0.4rem 0", fontWeight: 600 }}>Hen</th>
                      <th style={{ textAlign: "right", padding: "0.4rem", fontWeight: 600 }}>Eggs</th>
                      <th style={{ textAlign: "right", padding: "0.4rem", fontWeight: 600 }}>Active Days</th>
                      <th style={{ textAlign: "right", padding: "0.4rem", fontWeight: 600 }}>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.production_consistency.map((h) => (
                      <tr key={h.chicken_id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "0.4rem 0.4rem 0.4rem 0" }}>{h.chicken_name}</td>
                        <td style={{ padding: "0.4rem", textAlign: "right" }}>{h.egg_count}</td>
                        <td style={{ padding: "0.4rem", textAlign: "right" }}>{h.active_days}</td>
                        <td style={{ padding: "0.4rem", textAlign: "right", fontWeight: 600 }}>
                          {h.laying_rate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Dry Periods */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: "1.125rem", marginBottom: "1rem" }}>
              Dry Periods
              <span style={{ fontSize: "0.8rem", color: "#666", fontWeight: 400, marginLeft: "0.5rem" }}>
                (alert after {data.dry_threshold_days} days)
              </span>
            </h2>

            {data.dry_periods_alert.length > 0 && (
              <div
                style={{
                  padding: "0.75rem",
                  background: "#fff3e0",
                  border: "1px solid #ffcc02",
                  borderRadius: "6px",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ fontWeight: 600, color: "#e65100", marginBottom: "0.25rem" }}>
                  Needs attention
                </div>
                {data.dry_periods_alert.map((h) => (
                  <div key={h.chicken_id} style={{ fontSize: "0.9rem", padding: "0.15rem 0" }}>
                    {h.chicken_name} — {h.days_since_last_egg} day{h.days_since_last_egg !== 1 ? "s" : ""} since last egg
                  </div>
                ))}
              </div>
            )}

            {data.dry_periods_current.length === 0 ? (
              <p style={{ color: "#999", fontSize: "0.9rem" }}>No active laying hens.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #eee" }}>
                      <th style={{ textAlign: "left", padding: "0.4rem 0.4rem 0.4rem 0", fontWeight: 600 }}>Hen</th>
                      <th style={{ textAlign: "right", padding: "0.4rem", fontWeight: 600 }}>Days Since Last Egg</th>
                      <th style={{ textAlign: "right", padding: "0.4rem", fontWeight: 600 }}>Longest Streak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.dry_periods_current.map((h) => {
                      const longest = data.dry_periods_longest.find(
                        (l) => l.chicken_id === h.chicken_id
                      );
                      const alerted =
                        h.days_since_last_egg != null &&
                        h.days_since_last_egg >= data.dry_threshold_days;
                      return (
                        <tr
                          key={h.chicken_id}
                          style={{
                            borderBottom: "1px solid #eee",
                            background: alerted ? "#fff3e0" : "transparent",
                          }}
                        >
                          <td style={{ padding: "0.4rem 0.4rem 0.4rem 0", fontWeight: alerted ? 600 : 400 }}>
                            {h.chicken_name}
                            {alerted && (
                              <span
                                style={{
                                  marginLeft: "0.4rem",
                                  fontSize: "0.7rem",
                                  padding: "0.1rem 0.35rem",
                                  borderRadius: "3px",
                                  background: "#ff9800",
                                  color: "#fff",
                                  fontWeight: 600,
                                }}
                              >
                                Alert
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "0.4rem", textAlign: "right" }}>
                            {h.days_since_last_egg != null ? `${h.days_since_last_egg}d` : "-"}
                          </td>
                          <td style={{ padding: "0.4rem", textAlign: "right" }}>
                            {longest?.longest_streak_days != null ? `${longest.longest_streak_days}d` : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Seasonal Trends */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: "1.125rem", marginBottom: "1rem" }}>Seasonal Trends</h2>
            {data.seasonal_trends.length === 0 ? (
              <p style={{ color: "#999", fontSize: "0.9rem" }}>No data.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #eee" }}>
                      <th style={{ textAlign: "left", padding: "0.4rem 0.4rem 0.4rem 0", fontWeight: 600 }}>Period</th>
                      <th style={{ textAlign: "left", padding: "0.4rem", fontWeight: 600 }}>Season</th>
                      <th style={{ textAlign: "right", padding: "0.4rem", fontWeight: 600 }}>Eggs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.seasonal_trends.map((s, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "0.4rem 0.4rem 0.4rem 0" }}>
                          {s.year}-{String(s.month).padStart(2, "0")}
                        </td>
                        <td style={{ padding: "0.4rem" }}>
                          <span
                            style={{
                              padding: "0.1rem 0.4rem",
                              borderRadius: "3px",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              background:
                                s.season === "Summer"
                                  ? "#fff3e0"
                                  : s.season === "Autumn"
                                  ? "#fce4ec"
                                  : s.season === "Winter"
                                  ? "#e3f2fd"
                                  : "#e8f5e9",
                              color:
                                s.season === "Summer"
                                  ? "#e65100"
                                  : s.season === "Autumn"
                                  ? "#c62828"
                                  : s.season === "Winter"
                                  ? "#1565c0"
                                  : "#2e7d32",
                            }}
                          >
                            {s.season}
                          </span>
                        </td>
                        <td style={{ padding: "0.4rem", textAlign: "right", fontWeight: 600 }}>
                          {s.egg_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Attrition */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: "1.125rem", marginBottom: "1rem" }}>
              Attrition
              {data.attrition_rate != null && (
                <span style={{ fontSize: "0.9rem", color: "#666", fontWeight: 400, marginLeft: "0.5rem" }}>
                  (rate: {data.attrition_rate}%)
                </span>
              )}
            </h2>
            {data.attrition_by_reason.length === 0 ? (
              <p style={{ color: "#999", fontSize: "0.9rem" }}>No departures in this period.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #eee" }}>
                      <th style={{ textAlign: "left", padding: "0.4rem 0.4rem 0.4rem 0", fontWeight: 600 }}>Reason</th>
                      <th style={{ textAlign: "right", padding: "0.4rem", fontWeight: 600 }}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.attrition_by_reason.map((a, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "0.4rem 0.4rem 0.4rem 0", textTransform: "capitalize" }}>{a.reason}</td>
                        <td style={{ padding: "0.4rem", textAlign: "right", fontWeight: 600 }}>{a.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
