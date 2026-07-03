"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Chicken = {
  id: number;
  name: string;
  sex: string;
  breed_name: string | null;
  origin_source_name: string | null;
  acquisition_type_name: string | null;
  departed: boolean;
  departure_date: string | null;
  departure_reason: string | null;
  primary_photo_id: number | null;
  primary_photo_path: string | null;
};

type DynamicListEntry = {
  id: number;
  value: string;
};

const SEX_OPTIONS = ["Hen", "Rooster", "Unknown"] as const;

const DEPARTURE_REASONS = ["died/illness", "sold", "predator", "gave away", "Other"] as const;

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function RosterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [chickens, setChickens] = useState<Chicken[]>([]);
  const [name, setName] = useState("");
  const [sex, setSex] = useState<string>("Hen");
  const [breed, setBreed] = useState("");
  const [originSource, setOriginSource] = useState("");
  const [acquisitionType, setAcquisitionType] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [includeDeparted, setIncludeDeparted] = useState(false);
  const [departingChickenId, setDepartingChickenId] = useState<number | null>(null);
  const [departureDate, setDepartureDate] = useState(todayStr());
  const [departureReason, setDepartureReason] = useState("died/illness");
  const [departureOtherReason, setDepartureOtherReason] = useState("");
  const [departingSave, setDepartingSave] = useState(false);

  const [breeds, setBreeds] = useState<DynamicListEntry[]>([]);
  const [originSources, setOriginSources] = useState<DynamicListEntry[]>([]);
  const [acquisitionTypes, setAcquisitionTypes] = useState<DynamicListEntry[]>([]);

  const isAdmin = session?.user?.role === "Admin";

  const fetchChickens = useCallback(async (showDeparted = false) => {
    try {
      const url = showDeparted ? "/api/chickens?includeDeparted=true" : "/api/chickens";
      const res = await fetch(url);
      if (!res.ok) {
        setChickens([]);
        return;
      }
      const data = await res.json();
      setChickens(Array.isArray(data) ? data : []);
    } catch {
      setChickens([]);
    }
  }, []);

  const fetchDynamicList = useCallback(
    async (
      type: string,
      setter: (vals: DynamicListEntry[]) => void
    ) => {
      try {
        const res = await fetch(`/api/dynamic-lists/${type}`);
        if (res.ok) {
          const data = await res.json();
          setter(data);
        }
      } catch {
        // ignore
      }
    },
    []
  );

  useEffect(() => {
    fetchChickens(includeDeparted);
    fetchDynamicList("breeds", setBreeds);
    fetchDynamicList("origin-sources", setOriginSources);
    fetchDynamicList("acquisition-types", setAcquisitionTypes);
  }, [fetchChickens, fetchDynamicList, includeDeparted]);

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    setEnrolling(true);
    setEnrollError(null);

    try {
      const res = await fetch("/api/chickens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sex,
          breed: breed || undefined,
          origin_source: originSource || undefined,
          acquisition_type: acquisitionType || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setEnrollError(data.message || "Failed to enroll chicken");
        return;
      }

      setName("");
      setSex("Hen");
      setBreed("");
      setOriginSource("");
      setAcquisitionType("");
      await Promise.all([
        fetchChickens(includeDeparted),
        fetchDynamicList("breeds", setBreeds),
        fetchDynamicList("origin-sources", setOriginSources),
        fetchDynamicList("acquisition-types", setAcquisitionTypes),
      ]);
    } catch {
      setEnrollError("Failed to enroll chicken");
    } finally {
      setEnrolling(false);
    }
  }

  async function handleMarkDeparted(chicken: Chicken) {
    setDepartingSave(true);
    try {
      const reason = departureReason === "Other" ? departureOtherReason.trim() : departureReason;
      const res = await fetch(`/api/chickens/${chicken.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departed: true,
          departure_date: departureDate,
          departure_reason: reason || "Other",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setEnrollError(data.message || "Failed to mark as departed");
        return;
      }

      setDepartingChickenId(null);
      setDepartureDate(todayStr());
      setDepartureReason("died/illness");
      setDepartureOtherReason("");
      await fetchChickens(includeDeparted);
    } catch {
      setEnrollError("Failed to mark as departed");
    } finally {
      setDepartingSave(false);
    }
  }

  async function handleReinstate(chicken: Chicken) {
    try {
      const res = await fetch(`/api/chickens/${chicken.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departed: false,
          departure_date: null,
          departure_reason: null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setEnrollError(data.message || "Failed to reinstate");
        return;
      }

      await fetchChickens(includeDeparted);
    } catch {
      setEnrollError("Failed to reinstate");
    }
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        minHeight: "60vh", color: "#999", fontSize: "1rem",
      }}>
        Loading...
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
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
          padding: "1.5rem 2rem",
          borderRadius: "8px",
          border: "1px solid #ddd",
          background: "#fff",
          minWidth: "320px",
          width: "100%",
          maxWidth: "700px",
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
              flexDirection: "column",
              gap: "0.75rem",
              marginBottom: "1.5rem",
              padding: "1rem",
              border: "1px solid #e0e0e0",
              borderRadius: "6px",
              background: "#fafafa",
            }}
          >
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Chicken name"
                disabled={enrolling}
                required
                style={{
                  flex: "1 1 200px",
                  padding: "0.5rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "1rem",
                }}
              />
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                disabled={enrolling}
                style={{
                  padding: "0.5rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "1rem",
                }}
              >
                {SEX_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px", position: "relative" }}>
                <input
                  list="breed-list"
                  value={breed}
                  onChange={(e) => setBreed(e.target.value)}
                  placeholder="Breed (pick or type)"
                  disabled={enrolling}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "1rem",
                  }}
                />
                <datalist id="breed-list">
                  {breeds.map((b) => (
                    <option key={b.id} value={b.value} />
                  ))}
                </datalist>
              </div>
              <div style={{ flex: "1 1 200px", position: "relative" }}>
                <input
                  list="origin-list"
                  value={originSource}
                  onChange={(e) => setOriginSource(e.target.value)}
                  placeholder="Origin source (pick or type)"
                  disabled={enrolling}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "1rem",
                  }}
                />
                <datalist id="origin-list">
                  {originSources.map((o) => (
                    <option key={o.id} value={o.value} />
                  ))}
                </datalist>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px", position: "relative" }}>
                <input
                  list="acq-list"
                  value={acquisitionType}
                  onChange={(e) => setAcquisitionType(e.target.value)}
                  placeholder="Acquisition type (pick or type)"
                  disabled={enrolling}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "1rem",
                  }}
                />
                <datalist id="acq-list">
                  {acquisitionTypes.map((a) => (
                    <option key={a.id} value={a.value} />
                  ))}
                </datalist>
              </div>
              <button
                type="submit"
                disabled={enrolling || !name.trim()}
                style={{
                  padding: "0.5rem 1.5rem",
                  background: "#2e7d32",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "1rem",
                  cursor: "pointer",
                  opacity: enrolling || !name.trim() ? 0.6 : 1,
                  alignSelf: "flex-end",
                }}
              >
                {enrolling ? "Adding..." : "Add Chicken"}
              </button>
            </div>
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

        {session?.user && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "1rem",
              fontSize: "0.875rem",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={includeDeparted}
                onChange={(e) => setIncludeDeparted(e.target.checked)}
              />
              Show departed
            </label>
          </div>
        )}

        {chickens.length === 0 ? (
          <p style={{ color: "#999" }}>
            {includeDeparted ? "No chickens enrolled yet." : "No active chickens enrolled yet."}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #eee" }}>
                  <th style={{ textAlign: "left", padding: "0.5rem 0.5rem 0.5rem 0", fontWeight: 600, width: "40px" }}></th>
                  <th style={{ textAlign: "left", padding: "0.5rem", fontWeight: 600 }}>Name</th>
                  <th style={{ textAlign: "left", padding: "0.5rem", fontWeight: 600 }}>Sex</th>
                  <th style={{ textAlign: "left", padding: "0.5rem", fontWeight: 600 }}>Breed</th>
                  <th style={{ textAlign: "left", padding: "0.5rem", fontWeight: 600 }}>Origin</th>
                  <th style={{ textAlign: "left", padding: "0.5rem", fontWeight: 600 }}>Acquisition</th>
                  <th style={{ textAlign: "left", padding: "0.5rem", fontWeight: 600 }}>Status</th>
                  {isAdmin && <th style={{ textAlign: "center", padding: "0.5rem", fontWeight: 600 }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {chickens.map((chicken) => (
                  <tr
                    key={chicken.id}
                    style={{
                      borderBottom: "1px solid #eee",
                      background: chicken.departed ? "#f5f5f5" : "transparent",
                    }}
                  >
                    <td style={{ padding: "0.5rem 0.5rem 0.5rem 0", width: "40px" }}>
                      {chicken.primary_photo_path ? (
                        <img
                          src={`/api/photos/${chicken.primary_photo_path}`}
                          alt=""
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            objectFit: "cover",
                            background: "#f0f0f0",
                            display: "block",
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            background: "#f0f0f0",
                          }}
                        />
                      )}
                    </td>
                    <td style={{ padding: "0.5rem 0.5rem 0.5rem 0", fontWeight: 500 }}>
                      {session?.user ? (
                        <a
                          href={`/chickens/${chicken.id}`}
                          style={{ color: "#1565c0", textDecoration: "none" }}
                        >
                          {chicken.name}
                        </a>
                      ) : (
                        chicken.name
                      )}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <span
                        style={{
                          padding: "0.15rem 0.4rem",
                          borderRadius: "4px",
                          fontSize: "0.8rem",
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
                        }}
                      >
                        {chicken.sex}
                      </span>
                    </td>
                    <td style={{ padding: "0.5rem", color: "#666", fontSize: "0.9rem" }}>
                      {chicken.breed_name || "-"}
                    </td>
                    <td style={{ padding: "0.5rem", color: "#666", fontSize: "0.9rem" }}>
                      {chicken.origin_source_name || "-"}
                    </td>
                    <td style={{ padding: "0.5rem", color: "#666", fontSize: "0.9rem" }}>
                      {chicken.acquisition_type_name || "-"}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      {chicken.departed ? (
                        <span
                          style={{
                            padding: "0.15rem 0.4rem",
                            borderRadius: "4px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            background: "#ffebee",
                            color: "#b71c1c",
                          }}
                        >
                          Departed
                        </span>
                      ) : (
                        <span
                          style={{
                            padding: "0.15rem 0.4rem",
                            borderRadius: "4px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            background: "#e8f5e9",
                            color: "#2e7d32",
                          }}
                        >
                          Active
                        </span>
                      )}
                      {chicken.departed && chicken.departure_date && (
                        <span style={{ display: "block", fontSize: "0.75rem", color: "#888", marginTop: "0.2rem" }}>
                          {chicken.departure_date}
                          {chicken.departure_reason && ` · ${chicken.departure_reason}`}
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: "0.5rem", textAlign: "center" }}>
                        {departingChickenId === chicken.id ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.5rem",
                              padding: "0.75rem",
                              border: "1px solid #e0e0e0",
                              borderRadius: "6px",
                              background: "#fafafa",
                              minWidth: "220px",
                            }}
                          >
                            <input
                              type="date"
                              value={departureDate}
                              onChange={(e) => setDepartureDate(e.target.value)}
                              disabled={departingSave}
                              style={{
                                padding: "0.4rem",
                                border: "1px solid #ccc",
                                borderRadius: "4px",
                                fontSize: "0.85rem",
                              }}
                            />
                            <select
                              value={departureReason}
                              onChange={(e) => {
  setDepartureReason(e.target.value);
  if (e.target.value !== "Other") {
    setDepartureOtherReason("");
  }
}}
                              disabled={departingSave}
                              style={{
                                padding: "0.4rem",
                                border: "1px solid #ccc",
                                borderRadius: "4px",
                                fontSize: "0.85rem",
                              }}
                            >
                              {DEPARTURE_REASONS.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                            {departureReason === "Other" && (
                              <input
                                type="text"
                                value={departureOtherReason}
                                onChange={(e) => setDepartureOtherReason(e.target.value)}
                                placeholder="Describe reason..."
                                disabled={departingSave}
                                style={{
                                  padding: "0.4rem",
                                  border: "1px solid #ccc",
                                  borderRadius: "4px",
                                  fontSize: "0.85rem",
                                }}
                              />
                            )}
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                              <button
                                onClick={() => handleMarkDeparted(chicken)}
                                disabled={departingSave || (departureReason === "Other" && !departureOtherReason.trim())}
                                style={{
                                  padding: "0.3rem 0.5rem",
                                  fontSize: "0.8rem",
                                  border: "none",
                                  borderRadius: "4px",
                                  background: "#d32f2f",
                                  color: "#fff",
                                  cursor: "pointer",
                                  opacity: departingSave ? 0.6 : 1,
                                }}
                              >
                                {departingSave ? "Saving..." : "Confirm"}
                              </button>
                              <button
                                onClick={() => {
                                  setDepartingChickenId(null);
                                  setDepartureDate(todayStr());
                                  setDepartureReason("died/illness");
                                  setDepartureOtherReason("");
                                }}
                                disabled={departingSave}
                                style={{
                                  padding: "0.3rem 0.5rem",
                                  fontSize: "0.8rem",
                                  border: "1px solid #ccc",
                                  borderRadius: "4px",
                                  background: "#fff",
                                  cursor: "pointer",
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : chicken.departed ? (
                          <button
                            onClick={() => handleReinstate(chicken)}
                            style={{
                              padding: "0.25rem 0.5rem",
                              fontSize: "0.75rem",
                              border: "1px solid #a5d6a7",
                              borderRadius: "4px",
                              background: "#fff",
                              color: "#2e7d32",
                              cursor: "pointer",
                            }}
                          >
                            Reinstate
                          </button>
                        ) : (
                          <button
onClick={() => {
  if (departingChickenId !== null && departingChickenId !== chicken.id) {
    if (!confirm("Discard unsaved departure details?")) return;
  }
  setDepartingChickenId(chicken.id);
  setDepartureDate(todayStr());
  setDepartureReason("died/illness");
  setDepartureOtherReason("");
  setEnrollError(null);
}}
                            style={{
                              padding: "0.25rem 0.5rem",
                              fontSize: "0.75rem",
                              border: "1px solid #ef9a9a",
                              borderRadius: "4px",
                              background: "#fff",
                              color: "#c62828",
                              cursor: "pointer",
                            }}
                          >
                            Mark Departed
                          </button>
                        )}
                      </td>
                    )}
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
