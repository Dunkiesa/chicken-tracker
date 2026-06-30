"use client";

import { useEffect, useState } from "react";

type HealthStatus = {
  status: string;
  database: string;
  timestamp: string;
  message?: string;
};

export default function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then(async (res) => {
        const data: HealthStatus = await res.json();
        setHealth(data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to fetch");
      });
  }, []);

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>ChickenTrack</h1>
      <p style={{ marginBottom: "2rem", color: "#666" }}>
        Egg-production tracking for your backyard flock
      </p>

      <div
        style={{
          padding: "1.5rem 2rem",
          borderRadius: "8px",
          border: "1px solid #ddd",
          background: "#fff",
          minWidth: "320px",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
          System Status
        </h2>

        {error && (
          <p style={{ color: "#d32f2f" }}>
            Could not reach the API: {error}
          </p>
        )}

        {!health && !error && <p>Checking system health...</p>}

        {health && (
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "0.5rem 1rem",
            }}
          >
            <dt style={{ fontWeight: 600 }}>API:</dt>
            <dd style={{ color: health.status === "ok" ? "#2e7d32" : "#d32f2f" }}>
              {health.status === "ok" ? "Healthy" : "Unhealthy"}
            </dd>

            <dt style={{ fontWeight: 600 }}>Database:</dt>
            <dd
              style={{
                color: health.database === "connected" ? "#2e7d32" : "#d32f2f",
              }}
            >
              {health.database === "connected"
                ? "Connected"
                : "Disconnected"}
            </dd>

            <dt style={{ fontWeight: 600 }}>As at:</dt>
            <dd>{new Date(health.timestamp).toLocaleString()}</dd>

            {health.message && (
              <>
                <dt style={{ fontWeight: 600 }}>Details:</dt>
                <dd style={{ color: "#d32f2f" }}>{health.message}</dd>
              </>
            )}
          </dl>
        )}
      </div>
    </main>
  );
}
