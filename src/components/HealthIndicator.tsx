"use client";

import { useQuery } from "@tanstack/react-query";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import { IconButton, Tooltip, Snackbar, Alert } from "@mui/material";

type HealthStatus = {
  status: string;
  database: string;
  timestamp: string;
  message?: string;
};

async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch("/api/health");
  const data: HealthStatus = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Health check failed");
  return data;
}

export default function HealthIndicator() {
  const { data, isError } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 60000,
    retry: false,
  });

  const isHealthy = data?.status === "ok" && data?.database === "connected";

  return (
    <>
      <Tooltip title={isHealthy ? "System healthy" : "System unhealthy"}>
        <IconButton size="large" color="inherit" aria-label="system health">
          {isHealthy ? (
            <CheckCircleIcon sx={{ color: "success.main" }} />
          ) : (
            <ErrorIcon sx={{ color: "error.main" }} />
          )}
        </IconButton>
      </Tooltip>
      <Snackbar
        open={isError}
        autoHideDuration={6000}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" variant="filled" sx={{ width: "100%" }}>
          Unable to reach system health check
        </Alert>
      </Snackbar>
    </>
  );
}
