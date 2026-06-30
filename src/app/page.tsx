"use client";

import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

type Chicken = {
  id: number;
  name: string;
};

type HealthStatus = {
  status: string;
  database: string;
  timestamp: string;
  message?: string;
};

export default function Home() {
  const { data: session, status } = useSession();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chickens, setChickens] = useState<Chicken[]>([]);
  const [newName, setNewName] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const isAdmin = session?.user?.role === "Admin";

  useEffect(() => {
    fetch("/api/health")
      .then(async (res) => {
        const data: HealthStatus = await res.json();
        setHealth(data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to fetch");
      });

    fetchChickens();
  }, []);

  async function fetchChickens() {
    try {
      const res = await fetch("/api/chickens");
      const data = await res.json();
      setChickens(data);
    } catch {
      // ignore
    }
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    setEnrolling(true);
    setEnrollError(null);

    try {
      const res = await fetch("/api/chickens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });

      if (!res.ok) {
        const data = await res.json();
        setEnrollError(data.message || "Failed to enroll chicken");
        return;
      }

      setNewName("");
      await fetchChickens();
    } catch {
      setEnrollError("Failed to enroll chicken");
    } finally {
      setEnrolling(false);
    }
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem",
        gap: "2rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          maxWidth: "600px",
        }}
      >
        <h1 style={{ fontSize: "2rem" }}>ChickenTrack</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {status === "loading" && (
            <span style={{ color: "#999", fontSize: "0.875rem" }}>
              Loading...
            </span>
          )}
          {status === "unauthenticated" && (
            <button
              onClick={() => signIn("google")}
              style={{
                padding: "0.4rem 0.75rem",
                background: "#4285f4",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Sign in with Google
            </button>
          )}
          {session?.user && (
            <>
              {isAdmin && (
                <a
                  href="/admin"
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: "#1565c0",
                    color: "#fff",
                    borderRadius: "4px",
                    textDecoration: "none",
                    fontSize: "0.875rem",
                  }}
                >
                  Manage Users
                </a>
              )}
              <span style={{ color: "#666", fontSize: "0.875rem" }}>
                {session.user.email}
                <span
                  style={{
                    marginLeft: "0.4rem",
                    padding: "0.1rem 0.4rem",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    background: isAdmin ? "#e3f2fd" : "#f3e5f5",
                    color: isAdmin ? "#1565c0" : "#7b1fa2",
                  }}
                >
                  {session.user.role}
                </span>
              </span>
              <button
                onClick={() => signOut()}
                style={{
                  padding: "0.4rem 0.75rem",
                  background: "#d32f2f",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>

      <p style={{ color: "#666" }}>
        Egg-production tracking for your backyard flock
      </p>

      <div
        style={{
          padding: "1.5rem 2rem",
          borderRadius: "8px",
          border: "1px solid #ddd",
          background: "#fff",
          minWidth: "320px",
          width: "100%",
          maxWidth: "600px",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
          System Status
        </h2>
        {error && (
          <p style={{ color: "#d32f2f" }}>Could not reach the API: {error}</p>
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
            <dd
              style={{ color: health.status === "ok" ? "#2e7d32" : "#d32f2f" }}
            >
              {health.status === "ok" ? "Healthy" : "Unhealthy"}
            </dd>
            <dt style={{ fontWeight: 600 }}>Database:</dt>
            <dd
              style={{
                color: health.database === "connected" ? "#2e7d32" : "#d32f2f",
              }}
            >
              {health.database === "connected" ? "Connected" : "Disconnected"}
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

      <div
        style={{
          padding: "1.5rem 2rem",
          borderRadius: "8px",
          border: "1px solid #ddd",
          background: "#fff",
          minWidth: "320px",
          width: "100%",
          maxWidth: "600px",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
          Enrolled Chickens
        </h2>

        {session?.user && isAdmin && (
          <form
            onSubmit={handleEnroll}
            style={{
              display: "flex",
              gap: "0.5rem",
              marginBottom: "1.5rem",
            }}
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter chicken name"
              disabled={enrolling}
              style={{
                flex: 1,
                padding: "0.5rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "1rem",
              }}
            />
            <button
              type="submit"
              disabled={enrolling || !newName.trim()}
              style={{
                padding: "0.5rem 1rem",
                background: "#2e7d32",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                fontSize: "1rem",
                cursor: "pointer",
                opacity: enrolling || !newName.trim() ? 0.6 : 1,
              }}
            >
              {enrolling ? "Adding..." : "Add Chicken"}
            </button>
          </form>
        )}

        {session?.user && !isAdmin && (
          <p style={{ color: "#666", marginBottom: "1rem", fontSize: "0.875rem" }}>
            You are signed in as a Viewer. Only admins can add chickens.
          </p>
        )}

        {!session?.user && (
          <p style={{ color: "#999", marginBottom: "1rem", fontSize: "0.875rem" }}>
            Sign in to manage chickens.
          </p>
        )}

        {enrollError && (
          <p style={{ color: "#d32f2f", marginBottom: "1rem" }}>
            {enrollError}
          </p>
        )}

        {chickens.length === 0 ? (
          <p style={{ color: "#999" }}>
            No chickens enrolled yet. Add one above.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {chickens.map((chicken) => (
              <li
                key={chicken.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.5rem 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <span>{chicken.name}</span>
                <span style={{ color: "#999", fontSize: "0.875rem" }}>
                  ID: {chicken.id}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
