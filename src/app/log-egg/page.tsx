"use client";

import { useEffect, useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Chicken = {
  id: number;
  name: string;
  sex: string;
  departed: boolean;
  primary_photo_id: number | null;
  primary_photo_path: string | null;
};

type Egg = {
  id: number;
  chicken_id: number;
  chicken_name: string;
  weight: number;
  date: string;
  recorded_by: string;
};

type Warning = {
  type: "duplicate_date" | "weight_out_of_range";
  message: string;
};

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function LogEggPage() {
  return (
    <Suspense fallback={<main style={{ padding: "2rem", textAlign: "center", color: "#999" }}>Loading...</main>}>
      <LogEggContent />
    </Suspense>
  );
}

function LogEggContent() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [eggs, setEggs] = useState<Egg[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [batchDate, setBatchDate] = useState(todayStr());
  const [hens, setHens] = useState<Chicken[]>([]);
  const [existingEggsMap, setExistingEggsMap] = useState<Map<number, Egg>>(new Map());
  const [weights, setWeights] = useState<Record<number, string>>({});
  const [rowWarnings, setRowWarnings] = useState<Record<number, Warning[]>>({});

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }
    if (status !== "authenticated") return;
    (async () => {
      try {
        const res = await fetch("/api/eggs");
        if (res.ok) setEggs(await res.json());
      } catch {
        // ignore
      }
    })();
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/chickens")
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setHens((data as Chicken[]).filter((c) => c.sex === "Hen" && !c.departed)))
      .catch(() => {});
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      try {
        const res = await fetch(`/api/eggs?date=${batchDate}`);
        if (!res.ok) return;
        const data: Egg[] = await res.json();
        const map = new Map<number, Egg>();
        data.forEach((egg) => map.set(egg.chicken_id, egg));
        setExistingEggsMap(map);
      } catch {
        // ignore
      }
    })();
  }, [status, batchDate]);

  async function handleBulkSubmit() {
    setError(null);
    setSuccessMsg(null);
    setRowWarnings({});

    const entries = hens
      .filter((h) => !existingEggsMap.has(h.id) && weights[h.id] && parseFloat(weights[h.id]) > 0)
      .map((h) => ({
        chicken_id: h.id,
        weight: Math.round(parseFloat(weights[h.id]) * 100) / 100,
        date: batchDate,
      }));

    if (entries.length === 0) {
      setError("No eggs to log — fill in weights or all hens already logged for this date");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/eggs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entries),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to save eggs");
        return;
      }

      const result = await res.json();
      const warningMap: Record<number, Warning[]> = {};
      entries.forEach((entry, idx) => {
        if (result.warnings[idx]?.length > 0) {
          warningMap[entry.chicken_id] = result.warnings[idx];
        }
      });
      setRowWarnings(warningMap);

      setSuccessMsg(`Logged ${entries.length} egg(s)!`);
      setWeights({});

      const eggsRes = await fetch(`/api/eggs?date=${batchDate}`);
      if (eggsRes.ok) {
        const eggsData: Egg[] = await eggsRes.json();
        const map = new Map<number, Egg>();
        eggsData.forEach((egg) => map.set(egg.chicken_id, egg));
        setExistingEggsMap(map);
      }
    } catch {
      setError("Failed to save eggs");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return (
      <main style={{ padding: "2rem", textAlign: "center", color: "#999" }}>
        Loading...
      </main>
    );
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "1rem",
        gap: "1rem",
        maxWidth: "700px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
        }}
      >
        <h1 style={{ fontSize: "1.5rem" }}>Bulk Log</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <a
            href="/"
            style={{
              color: "#1565c0",
              textDecoration: "none",
              fontSize: "0.875rem",
            }}
          >
            &larr; Back
          </a>
        </div>
      </div>

      <div
        style={{
          width: "100%",
          padding: "1rem",
          borderRadius: "8px",
          border: "1px solid #ddd",
          background: "#fff",
        }}
      >
        <div style={{ marginBottom: "0.75rem" }}>
          <label
            htmlFor="batchDate"
            style={{
              display: "block",
              fontSize: "0.8rem",
              fontWeight: 600,
              marginBottom: "0.25rem",
              color: "#555",
            }}
          >
            Date
          </label>
          <input
            id="batchDate"
            type="date"
            value={batchDate}
            onChange={(e) => setBatchDate(e.target.value)}
            disabled={saving}
            style={{
              width: "100%",
              padding: "0.5rem",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "1rem",
              boxSizing: "border-box",
            }}
          />
        </div>

        {hens.length === 0 ? (
          <p style={{ padding: "1rem", color: "#999", textAlign: "center" }}>
            No laying hens available
          </p>
        ) : (
          <div
            style={{
              maxHeight: "400px",
              overflowY: "auto",
              border: "1px solid #e0e0e0",
              borderRadius: "4px",
              marginBottom: "1rem",
            }}
          >
            {hens.map((hen) => {
              const existing = existingEggsMap.get(hen.id);
              const isLogged = !!existing;
              const warning = rowWarnings[hen.id];
              return (
                <div
                  key={hen.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.6rem 0.75rem",
                    borderBottom: "1px solid #f0f0f0",
                    background: isLogged ? "#f5f5f5" : "transparent",
                  }}
                >
                  {hen.primary_photo_path ? (
                    <img
                      src={`/api/photos/${hen.primary_photo_path}`}
                      alt=""
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        objectFit: "cover",
                        background: "#f0f0f0",
                        flexShrink: 0,
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "#f0f0f0",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: "1 1 100px", fontWeight: 500, fontSize: "0.95rem", minWidth: 0 }}>
                    {hen.name}
                  </div>
                  {isLogged ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span style={{ fontSize: "0.85rem", color: "#666" }}>
                        {existing.weight.toFixed(2)}g
                      </span>
                      <span style={{ color: "#2e7d32", fontSize: "1rem" }}>✓</span>
                    </div>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={weights[hen.id] || ""}
                      onChange={(e) =>
                        setWeights((prev) => ({ ...prev, [hen.id]: e.target.value }))
                      }
                      placeholder="Weight (g)"
                      disabled={saving}
                      style={{
                        width: "110px",
                        padding: "0.4rem",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        fontSize: "0.9rem",
                        textAlign: "right",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {warning?.length > 0 && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#f57f17",
                        maxWidth: "160px",
                        textAlign: "right",
                        flexShrink: 0,
                      }}
                    >
                      {warning.map((w, i) => (
                        <div key={i}>{w.message}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "0.5rem 0.75rem",
              background: "#fff3e0",
              border: "1px solid #ffcc02",
              borderRadius: "4px",
              fontSize: "0.85rem",
              color: "#e65100",
              marginBottom: "0.75rem",
            }}
          >
            {error}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              padding: "0.5rem 0.75rem",
              background: "#e8f5e9",
              border: "1px solid #a5d6a7",
              borderRadius: "4px",
              fontSize: "0.85rem",
              color: "#2e7d32",
              marginBottom: "0.75rem",
            }}
          >
            {successMsg}
          </div>
        )}

        <button
          onClick={handleBulkSubmit}
          disabled={saving || hens.length === 0}
          style={{
            width: "100%",
            padding: "0.6rem 1rem",
            background: "#2e7d32",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            fontSize: "1rem",
            cursor: "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving..." : "Log All"}
        </button>
      </div>

      <div
        style={{
          width: "100%",
          padding: "1rem",
          borderRadius: "8px",
          border: "1px solid #ddd",
          background: "#fff",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>
          Recent Eggs
        </h2>
        {eggs.length === 0 ? (
          <p style={{ color: "#999", fontSize: "0.9rem" }}>No eggs logged yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #eee" }}>
                  <th style={{ textAlign: "left", padding: "0.4rem 0.4rem 0.4rem 0", fontWeight: 600 }}>Date</th>
                  <th style={{ textAlign: "left", padding: "0.4rem", fontWeight: 600 }}>Chicken</th>
                  <th style={{ textAlign: "right", padding: "0.4rem", fontWeight: 600 }}>Weight</th>
                </tr>
              </thead>
              <tbody>
                {eggs.map((egg) => (
                  <tr key={egg.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "0.4rem 0.4rem 0.4rem 0", color: "#555" }}>
                      {egg.date}
                    </td>
                    <td style={{ padding: "0.4rem", fontWeight: 500 }}>
                      {egg.chicken_name}
                    </td>
                    <td style={{ padding: "0.4rem", textAlign: "right" }}>
                      {egg.weight.toFixed(2)}g
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
