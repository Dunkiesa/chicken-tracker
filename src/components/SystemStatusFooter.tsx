"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type HealthStatus = {
  status: string;
  database: string;
  timestamp: string;
  message?: string;
};

export default function SystemStatusFooter() {
  const { status: authStatus } = useSession();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    fetch("/api/health")
      .then(async (res) => {
        const data: HealthStatus = await res.json();
        setHealth(data);
      })
      .catch(() => setError("unreachable"));
  }, [authStatus]);

  if (authStatus !== "authenticated") return null;

  return (
    <footer
      style={{
        padding: "0.5rem 1.5rem",
        borderTop: "1px solid #e0e0e0",
        fontSize: "0.75rem",
        color: "#888",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      {error && <span style={{ color: "#d32f2f" }}>API unavailable</span>}
      {!health && !error && <span>Checking system health...</span>}
      {health && (
        <>
          <span>
            API:{" "}
            <span
              style={{
                color: health.status === "ok" ? "#2e7d32" : "#d32f2f",
                fontWeight: 600,
              }}
            >
              {health.status === "ok" ? "Healthy" : "Unhealthy"}
            </span>
          </span>
          <span aria-hidden="true">|</span>
          <span>
            Database:{" "}
            <span
              style={{
                color: health.database === "connected" ? "#2e7d32" : "#d32f2f",
                fontWeight: 600,
              }}
            >
              {health.database === "connected" ? "Connected" : "Disconnected"}
            </span>
          </span>
          <span aria-hidden="true">|</span>
          <span>As at: {new Date(health.timestamp).toLocaleString()}</span>
        </>
      )}
    </footer>
  );
}
