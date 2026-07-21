"use client";

import { useState, Suspense, useMemo, useEffect, useCallback } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Slider,
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LoginIcon from "@mui/icons-material/Login";
import type {
  AnalyticsData,
  ProductionTimeSeries,
} from "@/lib/analytics";
import {
  todayStr,
  oneYearAgoStr,
  formatDateForPicker,
  formatDateForApi,
  formatDateForDisplay,
} from "@/lib/dateUtils";

type TimeGranularity = "daily" | "weekly" | "monthly";

async function fetchAnalytics(from: string, to: string, dryThreshold: number): Promise<AnalyticsData> {
  const res = await fetch(`/api/analytics?from=${from}&to=${to}&dry_threshold=${dryThreshold}`);
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.message || "Failed to load analytics");
  }
  return res.json();
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(() => searchParams.get("from") || oneYearAgoStr());
  const [dateTo, setDateTo] = useState(() => searchParams.get("to") || todayStr());
  const [granularity, setGranularity] = useState<TimeGranularity>("monthly");
  const [dryThreshold, setDryThreshold] = useState(4);
  const [drillStack, setDrillStack] = useState<
    { date: string; granularity: TimeGranularity }[]
  >([]);

  const isRangeBiggerThanMonth = useMemo(() => {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    return to.getTime() - from.getTime() > 31 * 24 * 60 * 60 * 1000;
  }, [dateFrom, dateTo]);

  const granularityOptions = useMemo(() => {
    const all: TimeGranularity[] = ["daily", "weekly", "monthly"];
    if (isRangeBiggerThanMonth) {
      return all.filter((g) => g !== "daily");
    }
    return all;
  }, [isRangeBiggerThanMonth]);

  useEffect(() => {
    if (isRangeBiggerThanMonth && granularity === "daily") {
      setGranularity("weekly");
    }
  }, [isRangeBiggerThanMonth, granularity]);

  useEffect(() => {
    setDrillStack([]);
  }, [granularity, dateFrom, dateTo]);

  useEffect(() => {
    router.replace(`/dashboard?from=${dateFrom}&to=${dateTo}`, { scroll: false });
  }, [dateFrom, dateTo, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("from")) {
      const el = document.getElementById("productivity");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["analytics", dateFrom, dateTo, dryThreshold],
    queryFn: () => fetchAnalytics(dateFrom, dateTo, dryThreshold),
    enabled: status === "authenticated",
    placeholderData: keepPreviousData,
  });

  const displayGranularity = useMemo(() => {
    if (drillStack.length === 0) return granularity;
    const lastDrill = drillStack[drillStack.length - 1]!;
    if (lastDrill.granularity === "monthly") return "weekly";
    return "daily";
  }, [granularity, drillStack]);

  const productionData = useMemo<ProductionTimeSeries[]>(() => {
    if (!data) return [];
    if (drillStack.length === 0) {
      if (granularity === "daily") return data.production_daily;
      if (granularity === "weekly") return data.production_weekly;
      return data.production_monthly;
    }
    const lastDrill = drillStack[drillStack.length - 1]!;
    if (lastDrill.granularity === "monthly") {
      const prefix = lastDrill.date + "-";
      return data.production_weekly.filter((w) => w.date.startsWith(prefix));
    }
    if (lastDrill.granularity === "weekly") {
      const weekStart = new Date(lastDrill.date);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return data.production_daily.filter((d) => {
        const dDate = new Date(d.date);
        return dDate >= weekStart && dDate <= weekEnd;
      });
    }
    return [];
  }, [data, granularity, drillStack]);

  const handleBarClick = useCallback(
    (
      _event: React.MouseEvent<SVGElement, MouseEvent>,
      barItemIdentifier: { dataIndex: number }
    ) => {
      if (displayGranularity === "daily") return;
      const clicked = productionData[barItemIdentifier.dataIndex];
      if (!clicked) return;
      setDrillStack((prev) => [
        ...prev,
        { date: clicked.date, granularity: displayGranularity },
      ]);
    },
    [productionData, displayGranularity]
  );

  const handleBack = useCallback(() => {
    setDrillStack((prev) => prev.slice(0, -1));
  }, []);

  if (status === "loading") {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (status === "unauthenticated") {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 2,
        }}
      >
        <Typography variant="h3" fontWeight={700}>
          ChickenTrack
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400, textAlign: "center" }}>
          Egg-production tracking for your backyard flock
        </Typography>
        <Button variant="contained" onClick={() => signIn("google")} aria-label="Sign in with Google" sx={{ mt: 1, minWidth: 0, p: 1.5 }}>
          <LoginIcon />
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Stack spacing={3} sx={{ maxWidth: 1200, mx: "auto" }}>
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="center">
                <DatePicker
                  label="From"
                  value={formatDateForPicker(dateFrom)}
                  onChange={(d) => d && setDateFrom(formatDateForApi(d))}
                  closeOnSelect
                  slotProps={{ textField: { size: "small", fullWidth: true } }}
                  sx={{ flex: 1, minWidth: 0 }}
                />
                <DatePicker
                  label="To"
                  value={formatDateForPicker(dateTo)}
                  onChange={(d) => d && setDateTo(formatDateForApi(d))}
                  closeOnSelect
                  slotProps={{ textField: { size: "small", fullWidth: true } }}
                  sx={{ flex: 1, minWidth: 0 }}
                />
              </Stack>
              <Stack direction="row" spacing={1} justifyContent="center">
                <Button
                  variant="outlined"
                  size="small"
                  aria-label="Export CSV"
                  onClick={() => {
                    const url = `/api/analytics?from=${dateFrom}&to=${dateTo}&format=csv`;
                    window.open(url, "_blank");
                  }}
                >
                  <FileDownloadIcon />
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  aria-label={isRefetching ? "Loading..." : "Refresh"}
                  disabled={isRefetching}
                  onClick={() => refetch()}
                >
                  <RefreshIcon />
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {error && (
          <Alert severity="error">{(error as Error).message}</Alert>
        )}

        {isLoading && !data && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {data && (
          <>
            <Grid container spacing={2}>
              {[
                { label: "Total Eggs", value: data.summary.total_eggs, color: "success.main" },
                {
                  label: "Avg Weight",
                  value: data.summary.average_weight != null ? `${data.summary.average_weight.toFixed(1)}g` : "-",
                  color: "info.main",
                },
                { label: "Active Hens", value: data.summary.active_laying_chickens, color: "warning.main" },
                { label: "Total Hens", value: data.summary.total_laying_chickens, color: "secondary.main" },
              ].map((card) => (
                <Grid size={{ xs: 6, sm: 3 }} key={card.label}>
                  <Card>
                    <CardContent sx={{ textAlign: "center" }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        fontWeight={600}
                        textTransform="uppercase"
                        letterSpacing={0.5}
                      >
                        {card.label}
                      </Typography>
                      <Typography variant="h5" fontWeight={700} sx={{ color: card.color, mt: 0.5 }}>
                        {card.value}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="h6">Production Over Time</Typography>
                    {drillStack.length > 0 && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleBack}
                      >
                        <ArrowBackIcon fontSize="small" />
                      </Button>
                    )}
                  </Stack>
                  {drillStack.length === 0 && (
                    <ToggleButtonGroup
                      value={granularity}
                      exclusive
                      onChange={(_, v) => v && setGranularity(v)}
                      size="small"
                    >
                      {granularityOptions.map((g) => (
                        <ToggleButton key={g} value={g}>
                          {g.charAt(0).toUpperCase() + g.slice(1)}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  )}
                </Stack>
                {productionData.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No eggs logged in this period.
                  </Typography>
                ) : (
                  <BarChart
                    dataset={productionData}
                    xAxis={[
                      {
                        scaleType: "band",
                        dataKey: "date",
                        valueFormatter: (d: string) => formatDateForDisplay(d),
                      },
                    ]}
                    series={[{ dataKey: "count" }]}
                    height={300}
                    slotProps={{ legend: { hidden: true } }}
                    grid={{ horizontal: true }}
                    onItemClick={handleBarClick}
                    sx={{ width: "100%", "& .MuiBarElement-root": { cursor: displayGranularity !== "daily" ? "pointer" : "default" } }}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Egg Weights
                </Typography>
                {(() => {
                  const weightMap = new Map(
                    data.average_weight_per_hen
                      .filter((h) => h.avg_weight != null)
                      .map((h) => [h.chicken_id, h.avg_weight!]),
                  );
                  const rows = data.weight_variance_per_hen.filter(
                    (h) =>
                      h.min_weight != null &&
                      h.max_weight != null &&
                      h.std_dev != null &&
                      weightMap.has(h.chicken_id),
                  );
                  if (rows.length === 0) {
                    return (
                      <Typography variant="body2" color="text.secondary">
                        No data.
                      </Typography>
                    );
                  }
                  const chartData = rows.map((h) => ({
                    chicken_name: h.chicken_name,
                    min_weight: h.min_weight!,
                    avg_weight: weightMap.get(h.chicken_id)!,
                    max_weight: h.max_weight!,
                  }));
                  const L = 55, R = 20, T = 20, B = 55;
                  const barGap = 40;
                  const padH = 20;
                  const totalH = 300;
                  const innerH = totalH - T - B;
                  const totalW = L + R + padH * 2 + chartData.length * barGap;
                  const dataMin = Math.min(...chartData.map((d) => d.min_weight));
                  const dataMax = Math.max(...chartData.map((d) => d.max_weight));
                  const padding = (dataMax - dataMin) * 0.1 || 1;
                  const yMin = dataMin - padding;
                  const yMax = dataMax + padding;
                  const yPos = (v: number) => T + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
                  const yTicks: number[] = [];
                  const yTickStep = (yMax - yMin) / 5;
                  for (let i = 0; i <= 5; i++) yTicks.push(Math.round(yMin + yTickStep * i));
                  return (
                    <Box sx={{ width: "100%", overflowX: "auto" }}>
                      <svg
                        viewBox={`0 0 ${totalW} ${totalH}`}
                        style={{ width: "100%", minWidth: chartData.length * 40 + 100 }}
                      >
                        <line x1={L} y1={T} x2={L} y2={T + innerH} stroke="#ccc" strokeWidth={1} />
                        <line x1={totalW - R} y1={T} x2={totalW - R} y2={T + innerH} stroke="#ccc" strokeWidth={1} />
                        <line x1={L} y1={T + innerH} x2={totalW - R} y2={T + innerH} stroke="#ccc" strokeWidth={1} />
                        {yTicks.map((t, i) => (
                          <g key={i}>
                            <line x1={L} y1={yPos(t)} x2={totalW - R} y2={yPos(t)} stroke="#eee" strokeWidth={1} />
                            <text x={L - 8} y={yPos(t)} textAnchor="end" dominantBaseline="central" fontSize={10} fill="#888">
                              {t}g
                            </text>
                          </g>
                        ))}
                        {chartData.map((d, i) => {
                          const cx = L + padH + barGap * i + barGap / 2;
                          const yHigh = yPos(d.min_weight);
                          const yLow = yPos(d.max_weight);
                          const yAvg = yPos(d.avg_weight);
                          return (
                            <g key={d.chicken_name}>
                              <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke="#90a4ae" strokeWidth={1.5} />
                              <circle cx={cx} cy={yAvg} r={4} fill="#1565c0" />
                              <text
                                x={cx}
                                y={T + innerH + 6}
                                textAnchor="start"
                                dominantBaseline="hanging"
                                fontSize={8}
                                fill="#666"
                                transform={`rotate(45, ${cx}, ${T + innerH + 6})`}
                              >
                                {d.chicken_name}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </Box>
                  );
                })()}
              </CardContent>
            </Card>

            <Card id="productivity">
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Productivity
                </Typography>
                {(() => {
                  if (data.most_productive.length === 0) {
                    return (
                      <Typography variant="body2" color="text.secondary">
                        No eggs logged in this period.
                      </Typography>
                    );
                  }
                  const top10 = data.most_productive.slice(0, 10);
                  const rest = data.most_productive.slice(10);
                  const otherCount = rest.reduce((sum, h) => sum + h.egg_count, 0);
                  const pieData = top10.map((h) => ({
                    id: h.chicken_id,
                    value: h.egg_count,
                    label: h.chicken_name,
                  }));
                  if (otherCount > 0) {
                    pieData.push({ id: -1, value: otherCount, label: "Other" });
                  }
                  const handleSliceClick = (
                    _event: React.MouseEvent<SVGPathElement>,
                    pieItemIdentifier: { dataIndex: number }
                  ) => {
                    const entry = pieData[pieItemIdentifier.dataIndex];
                    if (entry && entry.id !== undefined && Number(entry.id) > 0) {
                      const params = new URLSearchParams();
                      params.set("chicken_id", String(entry.id));
                      params.set("chicken_name", entry.label);
                      params.set("from", dateFrom);
                      params.set("to", dateTo);
                      router.push(`/dashboard/eggs?${params.toString()}`);
                    }
                  };

                  return (
                    <PieChart
                      series={[
                        {
                          data: pieData,
                          arcLabel: (item) => String(item.value),
                          arcLabelRadius: "85%",
                        },
                      ]}
                      height={300}
                      margin={{ right: 140 }}
                      onItemClick={handleSliceClick}
                      slotProps={{
                        pieArcLabel: {
                          fill: "#000",
                          fontWeight: 700,
                          fontSize: 12,
                        },
                        legend: {
                          direction: "column",
                          position: { vertical: "middle", horizontal: "right" },
                          labelStyle: { fontSize: 11 },
                          padding: 0,
                          itemGap: 4,
                        },
                      }}
                      sx={{ width: "100%", "& .MuiPieArc-root": { cursor: "pointer" } }}
                    />
                  );
                })()}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Production Consistency (Laying Rate)
                </Typography>
                {data.production_consistency.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No data.
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Hen</TableCell>
                          <TableCell align="right">Eggs</TableCell>
                          <TableCell align="right">Active Days</TableCell>
                          <TableCell align="right">Rate</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.production_consistency.filter((h) => h.laying_rate > 0).map((h) => (
                          <TableRow key={h.chicken_id}>
                            <TableCell>{h.chicken_name}</TableCell>
                            <TableCell align="right">{h.egg_count}</TableCell>
                            <TableCell align="right">{h.active_days}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                              {h.laying_rate}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1 }}>
                  <Typography variant="h6">Dry Periods</Typography>
                  <Typography variant="body2" color="text.secondary">
                    (alert after {dryThreshold} days)
                  </Typography>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">1d</Typography>
                  <Slider
                    value={dryThreshold}
                    onChange={(_, v) => setDryThreshold(v as number)}
                    min={1}
                    max={14}
                    step={1}
                    size="small"
                    sx={{ maxWidth: 200 }}
                  />
                  <Typography variant="caption" color="text.secondary">14d</Typography>
                </Stack>

                {data.dry_periods_current.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No active laying hens.
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Hen</TableCell>
                          <TableCell align="right">Last Egg</TableCell>
                          <TableCell align="right">Longest Streak</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[...data.dry_periods_current]
                          .filter((h) => h.days_since_last_egg != null && h.days_since_last_egg > 0)
                          .sort((a, b) => (b.days_since_last_egg ?? 0) - (a.days_since_last_egg ?? 0))
                          .map((h) => {
                          const longest = data.dry_periods_longest.find(
                            (l) => l.chicken_id === h.chicken_id
                          );
                          const alerted =
                            h.days_since_last_egg != null &&
                            h.days_since_last_egg >= data.dry_threshold_days;
                          return (
                            <TableRow
                              key={h.chicken_id}
                              sx={alerted ? { bgcolor: "warning.light" } : undefined}
                            >
                              <TableCell sx={{ fontWeight: alerted ? 600 : 400 }}>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                  <span>{h.chicken_name}</span>
                                  {alerted && (
                                    <Chip label="Alert" size="small" color="warning" />
                                  )}
                                </Stack>
                              </TableCell>
                              <TableCell align="right">
                                {h.days_since_last_egg != null ? `${h.days_since_last_egg}d` : "-"}
                              </TableCell>
                              <TableCell align="right">
                                {longest?.longest_streak_days != null ? `${longest.longest_streak_days}d` : "-"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Seasonal Trends
                </Typography>
                {data.seasonal_trends.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No data.
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Period</TableCell>
                          <TableCell>Season</TableCell>
                          <TableCell align="right">Eggs</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.seasonal_trends.map((s, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              {i === 0 || s.year !== data.seasonal_trends[i - 1]!.year
                                ? s.year
                                : ""}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={s.season}
                                size="small"
                                color={
                                  s.season === "Summer"
                                    ? "warning"
                                    : s.season === "Autumn"
                                      ? "error"
                                      : s.season === "Winter"
                                        ? "info"
                                        : "success"
                                }
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                              {s.egg_count}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 2 }}>
                  <Typography variant="h6">Attrition</Typography>
                  {data.attrition_rate != null && (
                    <Typography variant="body2" color="text.secondary">
                      (rate: {data.attrition_rate}%)
                    </Typography>
                  )}
                </Stack>
                {data.attrition_by_reason.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No departures in this period.
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Reason</TableCell>
                          <TableCell align="right">Count</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.attrition_by_reason.map((a, i) => (
                          <TableRow key={i}>
                            <TableCell sx={{ textTransform: "capitalize" }}>{a.reason}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>{a.count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </Stack>
    </Box>
  );
}
