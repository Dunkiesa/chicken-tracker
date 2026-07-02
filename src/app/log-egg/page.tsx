"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

type Chicken = {
  id: number;
  name: string;
  sex: string;
  departed: boolean;
  primary_photo_id: number | null;
  primary_photo_path: string | null;
};

type LayingContext = {
  chicken_id: number;
  chicken_name: string;
  last_egg_date: string | null;
  recent_avg_weight: number | null;
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

const WEIGHT_MIN = 20;
const WEIGHT_MAX = 200;

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

  const [chickens, setChickens] = useState<Chicken[]>([]);
  const [layingContext, setLayingContext] = useState<LayingContext[]>([]);
  const [eggs, setEggs] = useState<Egg[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [selectedChickenId, setSelectedChickenId] = useState<number | null>(null);
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [editingEggId, setEditingEggId] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [duplicateConfirmId, setDuplicateConfirmId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [batchDate, setBatchDate] = useState(todayStr());
  const [hens, setHens] = useState<Chicken[]>([]);
  const [existingEggsMap, setExistingEggsMap] = useState<Map<number, Egg>>(new Map());
  const [weights, setWeights] = useState<Record<number, string>>({});
  const [rowWarnings, setRowWarnings] = useState<Record<number, Warning[]>>({});

  const isAdmin = session?.user?.role === "Admin";
  const searchParams = useSearchParams();
  const quickMode = searchParams.get("quick") === "1";

  const fetchData = useCallback(async () => {
    try {
      const [chickensRes, contextRes, eggsRes] = await Promise.all([
        fetch("/api/chickens"),
        fetch("/api/eggs?context=true"),
        fetch("/api/eggs"),
      ]);
      if (chickensRes.ok) setChickens(await chickensRes.json());
      if (contextRes.ok) setLayingContext(await contextRes.json());
      if (eggsRes.ok) setEggs(await eggsRes.json());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }
    if (status === "authenticated") fetchData();
  }, [status, fetchData, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/chickens")
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setHens((data as Chicken[]).filter((c) => c.sex === "Hen" && !c.departed)))
      .catch(() => {});
  }, [status]);

  useEffect(() => {
    if (!quickMode || status !== "authenticated") return;
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
  }, [quickMode, status, batchDate]);

  function getContext(chickenId: number): LayingContext | undefined {
    return layingContext.find((c) => c.chicken_id === chickenId);
  }

  const filteredChickens = chickens.filter((c) => {
    if (!showAll && c.sex === "Rooster") return false;
    if (c.departed) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return c.name.toLowerCase().includes(q);
    }
    return true;
  });

  function resetForm() {
    setSelectedChickenId(null);
    setWeight("");
    setDate(todayStr());
    setEditingEggId(null);
    setWarnings([]);
    setDuplicateConfirmId(null);
    setError(null);
    setSuccessMsg(null);
  }

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

  async function handleSubmit() {
    setError(null);
    setSuccessMsg(null);
    setWarnings([]);

    if (!selectedChickenId) {
      setError("Please select a chicken");
      return;
    }
    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0) {
      setError("Please enter a valid weight");
      return;
    }
    if (!date) {
      setError("Please select a date");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        chicken_id: selectedChickenId,
        weight: Math.round(weightNum * 100) / 100,
        date,
      };

      if (duplicateConfirmId) {
        body.override_duplicate = true;
      }

      const isEditing = editingEggId !== null;
      const url = isEditing ? `/api/eggs/${editingEggId}` : "/api/eggs";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        const data = await res.json();
        if (data.code === "DUPLICATE_DATE") {
          setDuplicateConfirmId(data.existing_egg_id);
          setError(
            "This chicken already has an egg logged for this date. Save again to add another anyway."
          );
          return;
        }
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to save egg");
        return;
      }

      if (!isEditing) {
        const data = await res.json();
        if (data.warnings?.length > 0) {
          setWarnings(data.warnings);
        }
      }

      setSuccessMsg(isEditing ? "Egg updated!" : "Egg logged!");
      setDuplicateConfirmId(null);
      resetForm();
      await fetchData();
    } catch {
      setError("Failed to save egg");
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(egg: Egg) {
    setSelectedChickenId(egg.chicken_id);
    setWeight(egg.weight.toString());
    setDate(egg.date);
    setEditingEggId(egg.id);
    setWarnings([]);
    setDuplicateConfirmId(null);
    setError(null);
    setSuccessMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(egg: Egg) {
    if (!confirm(`Delete egg for ${egg.chicken_name} on ${egg.date}?`)) return;

    try {
      const res = await fetch(`/api/eggs/${egg.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to delete egg");
        return;
      }
      setSuccessMsg("Egg deleted!");
      await fetchData();
    } catch {
      setError("Failed to delete egg");
    }
  }

  const canDelete = (egg: Egg) =>
    isAdmin || egg.recorded_by === session?.user?.email;

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
        <h1 style={{ fontSize: "1.5rem" }}>{quickMode ? "Bulk Log" : "Log an Egg"}</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {quickMode && (
            <a
              href="/log-egg"
              style={{
                color: "#1565c0",
                textDecoration: "none",
                fontSize: "0.875rem",
              }}
            >
              Single entry &rarr;
            </a>
          )}
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
        {quickMode ? (
          <>
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
          </>
        ) : (
          <>
            <div style={{ marginBottom: "0.75rem" }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chickens..."
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

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.75rem",
                fontSize: "0.875rem",
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <input
                  type="checkbox"
                  checked={showAll}
                  onChange={(e) => setShowAll(e.target.checked)}
                />
                Show roosters
              </label>
              <span style={{ color: "#999" }}>
                {filteredChickens.length} of{" "}
                {chickens.filter((c) => !c.departed).length} eligible
              </span>
            </div>

            <div
              style={{
                maxHeight: "300px",
                overflowY: "auto",
                border: "1px solid #e0e0e0",
                borderRadius: "4px",
                marginBottom: "1rem",
              }}
            >
              {filteredChickens.length === 0 ? (
                <p style={{ padding: "1rem", color: "#999", textAlign: "center" }}>
                  {searchQuery ? "No chickens match your search" : "No laying-eligible chickens"}
                </p>
              ) : (
                filteredChickens.map((chicken) => {
                  const ctx = getContext(chicken.id);
                  const isSelected = selectedChickenId === chicken.id;
                  return (
                    <div
                      key={chicken.id}
                      onClick={() => setSelectedChickenId(chicken.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.6rem 0.75rem",
                        cursor: "pointer",
                        borderBottom: "1px solid #f0f0f0",
                        background: isSelected ? "#e3f2fd" : "transparent",
                      }}
                    >
                      <input
                        type="radio"
                        name="chicken"
                        checked={isSelected}
                        onChange={() => setSelectedChickenId(chicken.id)}
                        style={{ flexShrink: 0 }}
                      />
                      {chicken.primary_photo_path ? (
                        <img
                          src={`/api/photos/${chicken.primary_photo_path}`}
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
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: "0.95rem" }}>
                          {chicken.name}
                        </div>
                        {ctx && (
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "#666",
                              display: "flex",
                              gap: "0.75rem",
                              flexWrap: "wrap",
                            }}
                          >
                            {ctx.last_egg_date && (
                              <span>Last egg: {ctx.last_egg_date}</span>
                            )}
                            {ctx.recent_avg_weight && (
                              <span>Typical: ~{ctx.recent_avg_weight}g</span>
                            )}
                            {!ctx.last_egg_date && !ctx.recent_avg_weight && (
                              <span>No eggs logged yet</span>
                            )}
                          </div>
                        )}
                        {!ctx && (
                          <div style={{ fontSize: "0.75rem", color: "#999" }}>
                            No eggs logged yet
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          padding: "0.1rem 0.35rem",
                          borderRadius: "3px",
                          fontWeight: 600,
                          background:
                            chicken.sex === "Hen"
                              ? "#fce4ec"
                              : chicken.sex === "Rooster"
                              ? "#e3f2fd"
                              : "#f3e5f5",
                          color:
                            chicken.sex === "Hen"
                              ? "#c62828"
                              : chicken.sex === "Rooster"
                              ? "#1565c0"
                              : "#7b1fa2",
                          flexShrink: 0,
                        }}
                      >
                        {chicken.sex}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
            marginBottom: "0.75rem",
          }}
        >
          {!quickMode && (
            <>
              <div style={{ flex: "1 1 180px" }}>
                <label
                  htmlFor="weight"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    marginBottom: "0.25rem",
                    color: "#555",
                  }}
                >
                  Weight (g)
                </label>
                <input
                  id="weight"
                  type="number"
                  step="0.01"
                  min="0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="e.g. 58.34"
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
                {weight && parseFloat(weight) > 0 && warnings.length === 0 && (
                  <div style={{ fontSize: "0.75rem", color: "#999", marginTop: "0.2rem" }}>
                    {parseFloat(weight) < WEIGHT_MIN || parseFloat(weight) > WEIGHT_MAX
                      ? "Unusual weight — will warn on save"
                      : "Within typical range"}
                  </div>
                )}
              </div>
              <div style={{ flex: "1 1 180px" }}>
                <label
                  htmlFor="date"
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
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
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
            </>
          )}
        </div>

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

        {warnings.length > 0 && (
          <div
            style={{
              padding: "0.5rem 0.75rem",
              background: "#fff8e1",
              border: "1px solid #ffd54f",
              borderRadius: "4px",
              fontSize: "0.85rem",
              color: "#f57f17",
              marginBottom: "0.75rem",
            }}
          >
            {warnings.map((w, i) => (
              <div key={i}>{w.message}</div>
            ))}
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

        <div style={{ display: "flex", gap: "0.5rem" }}>
          {quickMode ? (
            <button
              onClick={handleBulkSubmit}
              disabled={saving || hens.length === 0}
              style={{
                flex: 1,
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
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving || !selectedChickenId || !weight || !date}
              style={{
                flex: 1,
                padding: "0.6rem 1rem",
                background: "#2e7d32",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                fontSize: "1rem",
                cursor: "pointer",
                opacity: saving || !selectedChickenId || !weight || !date ? 0.6 : 1,
              }}
            >
              {saving
                ? "Saving..."
                : editingEggId
                ? "Update Egg"
                : duplicateConfirmId
                ? "Save Anyway"
                : "Log Egg"}
            </button>
          )}
          {editingEggId && (
            <button
              onClick={resetForm}
              disabled={saving}
              style={{
                padding: "0.6rem 1rem",
                background: "#757575",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                fontSize: "1rem",
                cursor: "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              Cancel
            </button>
          )}
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
                  <th style={{ textAlign: "center", padding: "0.4rem", fontWeight: 600 }}>Actions</th>
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
                    <td style={{ padding: "0.4rem", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "0.3rem", justifyContent: "center" }}>
                        {canDelete(egg) && (
                          <>
                            <button
                              onClick={() => handleEdit(egg)}
                              style={{
                                padding: "0.2rem 0.5rem",
                                fontSize: "0.75rem",
                                border: "1px solid #ccc",
                                borderRadius: "3px",
                                background: "#fff",
                                cursor: "pointer",
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(egg)}
                              style={{
                                padding: "0.2rem 0.5rem",
                                fontSize: "0.75rem",
                                border: "1px solid #ef9a9a",
                                borderRadius: "3px",
                                background: "#fff",
                                color: "#c62828",
                                cursor: "pointer",
                              }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
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
