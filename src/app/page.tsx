"use client";

import { useState, Suspense, useMemo } from "react";
import { useSession, signIn } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
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
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import RefreshIcon from "@mui/icons-material/Refresh";
import type {
  AnalyticsData,
  ProductionTimeSeries,
} from "@/lib/analytics";

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

function formatDateForPicker(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateForApi(date: Date | null): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function fetchAnalytics(from: string, to: string): Promise<AnalyticsData> {
  const res = await fetch(`/api/analytics?from=${from}&to=${to}`);
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.message || "Failed to load analytics");
  }
  return res.json();
}

export default function Home() {
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
  const [dateFrom, setDateFrom] = useState(oneYearAgoStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [granularity, setGranularity] = useState<TimeGranularity>("monthly");

  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["analytics", dateFrom, dateTo],
    queryFn: () => fetchAnalytics(dateFrom, dateTo),
    enabled: status === "authenticated",
  });

  const productionData = useMemo<ProductionTimeSeries[]>(
    () =>
      data
        ? granularity === "daily"
          ? data.production_daily
          : granularity === "weekly"
            ? data.production_weekly
            : data.production_monthly
        : [],
    [data, granularity]
  );

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
        <Button variant="contained" onClick={() => signIn("google")} sx={{ mt: 1 }}>
          Sign in with Google
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Stack spacing={3} sx={{ maxWidth: 1200, mx: "auto" }}>
        <Typography variant="h5" component="h1">
          Analytics Dashboard
        </Typography>

        <Card>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
              <DatePicker
                label="From"
                value={formatDateForPicker(dateFrom)}
                onChange={(d) => d && setDateFrom(formatDateForApi(d))}
                slotProps={{ textField: { size: "small" } }}
              />
              <DatePicker
                label="To"
                value={formatDateForPicker(dateTo)}
                onChange={(d) => d && setDateTo(formatDateForApi(d))}
                slotProps={{ textField: { size: "small" } }}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<FileDownloadIcon />}
                onClick={() => {
                  const url = `/api/analytics?from=${dateFrom}&to=${dateTo}&format=csv`;
                  window.open(url, "_blank");
                }}
              >
                Export CSV
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                disabled={isRefetching}
                onClick={() => refetch()}
              >
                {isRefetching ? "Loading..." : "Refresh"}
              </Button>
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
                <Grid item xs={6} sm={3} key={card.label}>
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
                  <Typography variant="h6">Production Over Time</Typography>
                  <ToggleButtonGroup
                    value={granularity}
                    exclusive
                    onChange={(_, v) => v && setGranularity(v)}
                    size="small"
                  >
                    {(["daily", "weekly", "monthly"] as TimeGranularity[]).map((g) => (
                      <ToggleButton key={g} value={g}>
                        {g.charAt(0).toUpperCase() + g.slice(1)}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Stack>
                {productionData.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No eggs logged in this period.
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Period</TableCell>
                          <TableCell align="right">Eggs</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {productionData.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell>{row.date}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                              {row.count}
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
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Average Egg Weight
                </Typography>
                {data.average_weight_per_hen.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No data.
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Hen</TableCell>
                          <TableCell align="right">Avg Weight (g)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.average_weight_per_hen.map((h) => (
                          <TableRow key={h.chicken_id}>
                            <TableCell>{h.chicken_name}</TableCell>
                            <TableCell align="right">
                              {h.avg_weight != null ? h.avg_weight.toFixed(1) : "-"}
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
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Egg Weight Variance
                </Typography>
                {data.weight_variance_per_hen.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No data.
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Hen</TableCell>
                          <TableCell align="right">Min (g)</TableCell>
                          <TableCell align="right">Max (g)</TableCell>
                          <TableCell align="right">Std Dev</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.weight_variance_per_hen.map((h) => (
                          <TableRow key={h.chicken_id}>
                            <TableCell>{h.chicken_name}</TableCell>
                            <TableCell align="right">
                              {h.min_weight != null ? h.min_weight.toFixed(1) : "-"}
                            </TableCell>
                            <TableCell align="right">
                              {h.max_weight != null ? h.max_weight.toFixed(1) : "-"}
                            </TableCell>
                            <TableCell align="right">
                              {h.std_dev != null ? h.std_dev.toFixed(2) : "-"}
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
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Most Productive Chickens
                </Typography>
                {data.most_productive.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No eggs logged in this period.
                  </Typography>
                ) : (
                  <Stack component="ol" spacing={0.5} sx={{ pl: 1.5, m: 0, listStyleType: "decimal" }}>
                    {data.most_productive.map((h) => (
                      <Box component="li" key={h.chicken_id}>
                        <Typography variant="body2" component="span">
                          <strong>{h.chicken_name}</strong>{" "}
                          <Typography variant="body2" component="span" color="text.secondary">
                            {h.egg_count} egg{h.egg_count !== 1 ? "s" : ""}
                          </Typography>
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
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
                        {data.production_consistency.map((h) => (
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
                <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 2 }}>
                  <Typography variant="h6">Dry Periods</Typography>
                  <Typography variant="body2" color="text.secondary">
                    (alert after {data.dry_threshold_days} days)
                  </Typography>
                </Stack>

                {data.dry_periods_alert.length > 0 && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Needs attention
                    </Typography>
                    {data.dry_periods_alert.map((h) => (
                      <Typography key={h.chicken_id} variant="body2">
                        {h.chicken_name} — {h.days_since_last_egg} day{h.days_since_last_egg !== 1 ? "s" : ""} since last egg
                      </Typography>
                    ))}
                  </Alert>
                )}

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
                          <TableCell align="right">Days Since Last Egg</TableCell>
                          <TableCell align="right">Longest Streak</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.dry_periods_current.map((h) => {
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
                              {s.year}-{String(s.month).padStart(2, "0")}
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
