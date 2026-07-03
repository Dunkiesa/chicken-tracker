"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";

type Chicken = {
  id: number;
  name: string;
  sex: string;
  breed_name: string | null;
  origin_source_name: string | null;
  acquisition_type_name: string | null;
  acquisition_date: string | null;
  departed: boolean;
  departure_date: string | null;
  departure_reason: string | null;
  created_at: string;
  primary_photo_id: number | null;
};

type Note = {
  id: number;
  chicken_id: number;
  chicken_name: string;
  content: string;
  date: string;
  recorded_by: string;
  created_at: string;
  updated_at: string;
};

type Photo = {
  id: number;
  chicken_id: number;
  file_path: string;
  description: string | null;
  recorded_by: string;
  created_at: string;
};

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ChickenProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const chickenId = parseInt(params.id as string, 10);

  const [chicken, setChicken] = useState<Chicken | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);

  const [newContent, setNewContent] = useState("");
  const [newDate, setNewDate] = useState(todayStr());
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);

  const [uploadDescription, setUploadDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [savingChicken, setSavingChicken] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSex, setEditSex] = useState<"Hen" | "Rooster" | "Unknown">("Unknown");
  const [editBreed, setEditBreed] = useState("");
  const [editOrigin, setEditOrigin] = useState("");
  const [editAcquisition, setEditAcquisition] = useState("");
  const [editAcquisitionDate, setEditAcquisitionDate] = useState("");
  const [editDeparted, setEditDeparted] = useState(false);
  const [editDepartureDate, setEditDepartureDate] = useState("");
  const [editDepartureReason, setEditDepartureReason] = useState("");

  const [breeds, setBreeds] = useState<{ id: number; value: string }[]>([]);
  const [originSources, setOriginSources] = useState<{ id: number; value: string }[]>([]);
  const [acquisitionTypes, setAcquisitionTypes] = useState<{ id: number; value: string }[]>([]);

  const isAdmin = session?.user?.role === "Admin";

  const fetchDynamicLists = useCallback(async () => {
    try {
      const [breedsRes, originsRes, acquisitionsRes] = await Promise.all([
        fetch("/api/dynamic-lists/breeds"),
        fetch("/api/dynamic-lists/origin-sources"),
        fetch("/api/dynamic-lists/acquisition-types"),
      ]);
      if (breedsRes.ok) setBreeds(await breedsRes.json());
      if (originsRes.ok) setOriginSources(await originsRes.json());
      if (acquisitionsRes.ok) setAcquisitionTypes(await acquisitionsRes.json());
    } catch {
      // ignore
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (isNaN(chickenId)) return;
    try {
      const [chickenRes, notesRes, photosRes] = await Promise.all([
        fetch(`/api/chickens/${chickenId}`),
        fetch(`/api/chickens/${chickenId}/notes`),
        fetch(`/api/chickens/${chickenId}/photos`),
      ]);
      if (chickenRes.ok) setChicken(await chickenRes.json());
      if (notesRes.ok) setNotes(await notesRes.json());
      if (photosRes.ok) setPhotos(await photosRes.json());
    } catch {
      // ignore
    }
  }, [chickenId]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }
    if (status === "authenticated" && !isNaN(chickenId)) {
      fetchData();
      fetchDynamicLists();
    }
  }, [status, chickenId, fetchData, router, fetchDynamicLists]);

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!newContent.trim()) return;

    setAdding(true);
    try {
      const res = await fetch(`/api/chickens/${chickenId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent.trim(), date: newDate }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to add note");
        return;
      }

      setNewContent("");
      setNewDate(todayStr());
      await fetchData();
    } catch {
      setError("Failed to add note");
    } finally {
      setAdding(false);
    }
  }

  async function handleUpdateNote(noteId: number) {
    setError(null);
    if (!editContent.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(
        `/api/chickens/${chickenId}/notes/${noteId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: editContent.trim(),
            date: editDate,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to update note");
        return;
      }

      setEditingNoteId(null);
      setEditContent("");
      setEditDate("");
      await fetchData();
    } catch {
      setError("Failed to update note");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteNote(noteId: number) {
    if (!confirm("Delete this note?")) return;

    try {
      const res = await fetch(
        `/api/chickens/${chickenId}/notes/${noteId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to delete note");
        return;
      }

      await fetchData();
    } catch {
      setError("Failed to delete note");
    }
  }

  async function handleUploadPhoto(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (uploadDescription.trim()) {
        formData.append("description", uploadDescription.trim());
      }

      const res = await fetch(`/api/chickens/${chickenId}/photos`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to upload photo");
        return;
      }

      setUploadDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchData();
    } catch {
      setError("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  }

  async function handleSetPrimary(photoId: number) {
    setError(null);
    try {
      const res = await fetch(
        `/api/chickens/${chickenId}/photos/${photoId}/primary`,
        { method: "PUT" }
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to set primary photo");
        return;
      }
      await fetchData();
    } catch {
      setError("Failed to set primary photo");
    }
  }

  async function handleDeletePhoto(photoId: number) {
    if (!confirm("Delete this photo?")) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/chickens/${chickenId}/photos/${photoId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to delete photo");
        return;
      }
      await fetchData();
    } catch {
      setError("Failed to delete photo");
    }
  }

  function startEdit(note: Note) {
    setEditingNoteId(note.id);
    setEditContent(note.content);
    setEditDate(note.date);
    setError(null);
  }

  function cancelEdit() {
    setEditingNoteId(null);
    setEditContent("");
    setEditDate("");
  }

  function startEditChicken() {
    if (!chicken) return;
    setEditing(true);
    setEditName(chicken.name);
    setEditSex(chicken.sex as "Hen" | "Rooster" | "Unknown");
    setEditBreed(chicken.breed_name || "");
    setEditOrigin(chicken.origin_source_name || "");
    setEditAcquisition(chicken.acquisition_type_name || "");
    setEditAcquisitionDate(chicken.acquisition_date || "");
    setEditDeparted(chicken.departed);
    setEditDepartureDate(chicken.departure_date || "");
    setEditDepartureReason(chicken.departure_reason || "");
    setError(null);
  }

  function cancelEditChicken() {
    setEditing(false);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!editName.trim()) return;

    setSavingChicken(true);
    try {
      const updates: Record<string, unknown> = {
        name: editName.trim(),
        sex: editSex,
      };

      if (editBreed.trim()) {
        updates.breed = editBreed.trim();
      }
      if (editOrigin.trim()) {
        updates.origin_source = editOrigin.trim();
      }
      if (editAcquisition.trim()) {
        updates.acquisition_type = editAcquisition.trim();
      }
      if (editAcquisitionDate) {
        updates.acquisition_date = editAcquisitionDate;
      } else {
        updates.acquisition_date = null;
      }
      updates.departed = editDeparted;
      if (editDepartureDate) {
        updates.departure_date = editDepartureDate;
      }
      if (editDepartureReason.trim()) {
        updates.departure_reason = editDepartureReason.trim();
      }

      const res = await fetch(`/api/chickens/${chickenId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to update chicken");
        setSavingChicken(false);
        return;
      }

      setEditing(false);
      await fetchData();
    } catch {
      setError("Failed to update chicken");
    } finally {
      setSavingChicken(false);
    }
  }

  const canModify = (note: Note) =>
    isAdmin || note.recorded_by === session?.user?.email;

  if (status === "loading" || !chicken) {
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
        padding: "1.5rem",
        gap: "1.5rem",
        maxWidth: "700px",
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: "1.5rem" }}>{chicken.name}</h1>

      <div
        style={{
          width: "100%",
          padding: "1.25rem 1.5rem",
          borderRadius: "8px",
          border: "1px solid #ddd",
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "0.5rem 1rem",
            fontSize: "0.9rem",
          }}
        >
          <span style={{ fontWeight: 600, color: "#555" }}>Sex</span>
          <span>
            <span
              style={{
                padding: "0.1rem 0.4rem",
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
          </span>
          <span style={{ fontWeight: 600, color: "#555" }}>Breed</span>
          <span>{chicken.breed_name || "-"}</span>
          <span style={{ fontWeight: 600, color: "#555" }}>Origin</span>
          <span>{chicken.origin_source_name || "-"}</span>
          <span style={{ fontWeight: 600, color: "#555" }}>Acquisition</span>
          <span>{chicken.acquisition_type_name || "-"}</span>
          <span style={{ fontWeight: 600, color: "#555" }}>Acquisition Date</span>
          <span>{chicken.acquisition_date || "-"}</span>
          <span style={{ fontWeight: 600, color: "#555" }}>Status</span>
          <span>
            {chicken.departed ? (
              <span
                style={{
                  padding: "0.1rem 0.4rem",
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
                  padding: "0.1rem 0.4rem",
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
              <span style={{ marginLeft: "0.5rem", color: "#888", fontSize: "0.8rem" }}>
                {chicken.departure_date}
                {chicken.departure_reason && ` · ${chicken.departure_reason}`}
              </span>
            )}
          </span>
        </div>
      </div>

      {editing && isAdmin && (
        <div
          style={{
            width: "100%",
            padding: "1.25rem 1.5rem",
            borderRadius: "8px",
            border: "1px solid #1565c0",
            background: "#fff",
          }}
        >
          <h2 style={{ fontSize: "1.125rem", marginBottom: "1rem" }}>
            Edit Chicken
          </h2>
          <form
            onSubmit={handleSaveEdit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "0.5rem", alignItems: "center" }}>
              <label style={{ fontWeight: 600, color: "#555", fontSize: "0.9rem" }}>Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                style={{
                  padding: "0.5rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "0.9rem",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "0.5rem", alignItems: "center" }}>
              <label style={{ fontWeight: 600, color: "#555", fontSize: "0.9rem" }}>Sex</label>
              <select
                value={editSex}
                onChange={(e) => setEditSex(e.target.value as "Hen" | "Rooster" | "Unknown")}
                style={{
                  padding: "0.5rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "0.9rem",
                  background: "#fff",
                }}
              >
                <option value="Unknown">Unknown</option>
                <option value="Hen">Hen</option>
                <option value="Rooster">Rooster</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "0.5rem", alignItems: "center" }}>
              <label style={{ fontWeight: 600, color: "#555", fontSize: "0.9rem" }}>Breed</label>
              <input
                type="text"
                value={editBreed}
                onChange={(e) => setEditBreed(e.target.value)}
                list="breeds-list"
                placeholder="Select or type new"
                style={{
                  padding: "0.5rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "0.9rem",
                }}
              />
              <datalist id="breeds-list">
                {breeds.map((b) => (
                  <option key={b.id} value={b.value} />
                ))}
              </datalist>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "0.5rem", alignItems: "center" }}>
              <label style={{ fontWeight: 600, color: "#555", fontSize: "0.9rem" }}>Origin Source</label>
              <input
                type="text"
                value={editOrigin}
                onChange={(e) => setEditOrigin(e.target.value)}
                list="origin-list"
                placeholder="Select or type new"
                style={{
                  padding: "0.5rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "0.9rem",
                }}
              />
              <datalist id="origin-list">
                {originSources.map((o) => (
                  <option key={o.id} value={o.value} />
                ))}
              </datalist>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "0.5rem", alignItems: "center" }}>
              <label style={{ fontWeight: 600, color: "#555", fontSize: "0.9rem" }}>Acquisition Type</label>
              <input
                type="text"
                value={editAcquisition}
                onChange={(e) => setEditAcquisition(e.target.value)}
                list="acquisition-list"
                placeholder="Select or type new"
                style={{
                  padding: "0.5rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "0.9rem",
                }}
              />
              <datalist id="acquisition-list">
                {acquisitionTypes.map((a) => (
                  <option key={a.id} value={a.value} />
                ))}
              </datalist>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "0.5rem", alignItems: "center" }}>
              <label style={{ fontWeight: 600, color: "#555", fontSize: "0.9rem" }}>Acquisition Date</label>
              <input
                type="date"
                value={editAcquisitionDate}
                onChange={(e) => setEditAcquisitionDate(e.target.value)}
                style={{
                  padding: "0.5rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "0.9rem",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "0.5rem", alignItems: "center" }}>
              <label style={{ fontWeight: 600, color: "#555", fontSize: "0.9rem" }}>Status</label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={editDeparted}
                  onChange={(e) => setEditDeparted(e.target.checked)}
                  style={{ width: "auto", cursor: "pointer" }}
                />
                <span style={{ fontSize: "0.9rem" }}>Departed</span>
              </div>
            </div>

            {editDeparted && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "0.5rem", alignItems: "center" }}>
                  <label style={{ fontWeight: 600, color: "#555", fontSize: "0.9rem" }}>Departure Date</label>
                  <input
                    type="date"
                    value={editDepartureDate}
                    onChange={(e) => setEditDepartureDate(e.target.value)}
                    style={{
                      padding: "0.5rem",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                    }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "0.5rem", alignItems: "center" }}>
                  <label style={{ fontWeight: 600, color: "#555", fontSize: "0.9rem" }}>Reason</label>
                  <input
                    type="text"
                    value={editDepartureReason}
                    onChange={(e) => setEditDepartureReason(e.target.value)}
                    placeholder="Reason (optional)"
                    style={{
                      padding: "0.5rem",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                    }}
                  />
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button
                type="submit"
                disabled={savingChicken || !editName.trim()}
                style={{
                  padding: "0.4rem 1rem",
                  background: savingChicken ? "#90caf9" : "#1565c0",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "0.9rem",
                  cursor: savingChicken || !editName.trim() ? "not-allowed" : "pointer",
                  opacity: savingChicken || !editName.trim() ? 0.6 : 1,
                }}
              >
                 {savingChicken ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={cancelEditChicken}
                disabled={savingChicken}
                style={{
                  padding: "0.4rem 1rem",
                  background: "#757575",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "0.9rem",
                  cursor: savingChicken ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isAdmin && (
        <div
          style={{
            width: "100%",
            padding: "1.25rem 1.5rem",
            borderRadius: "8px",
            border: "1px solid #ddd",
            background: "#fff",
          }}
        >
          <h2 style={{ fontSize: "1.125rem", marginBottom: "1rem" }}>
            Add Photo
          </h2>
          <form
            onSubmit={handleUploadPhoto}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              disabled={uploading}
              style={{
                padding: "0.4rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "0.9rem",
              }}
            />
            <input
              type="text"
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              placeholder="Description (optional)"
              disabled={uploading}
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "0.9rem",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button
                type="submit"
                disabled={uploading}
                style={{
                  padding: "0.4rem 1rem",
                  background: "#2e7d32",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  opacity: uploading ? 0.6 : 1,
                }}
              >
                {uploading ? "Uploading..." : "Upload Photo"}
              </button>
            </div>
          </form>
        </div>
      )}

      {photos.length > 0 && (
        <div
          style={{
            width: "100%",
            padding: "1.25rem 1.5rem",
            borderRadius: "8px",
            border: "1px solid #ddd",
            background: "#fff",
          }}
        >
          <h2 style={{ fontSize: "1.125rem", marginBottom: "1rem" }}>
            Photos
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {photos.map((photo) => {
              const isPrimary = chicken?.primary_photo_id === photo.id;
              return (
                <div
                  key={photo.id}
                  style={{
                    padding: "0.75rem",
                    border: isPrimary ? "2px solid #2e7d32" : "1px solid #e0e0e0",
                    borderRadius: "6px",
                    background: isPrimary ? "#f1f8e9" : "#fafafa",
                  }}
                >
                  <img
                    src={`/api/photos/${photo.file_path}`}
                    alt={photo.description || "Chicken photo"}
                    style={{
                      width: "100%",
                      maxHeight: "400px",
                      objectFit: "contain",
                      borderRadius: "4px",
                      background: "#f0f0f0",
                    }}
                  />
                  {photo.description && (
                    <p
                      style={{
                        marginTop: "0.5rem",
                        fontSize: "0.9rem",
                        color: "#333",
                      }}
                    >
                      {photo.description}
                    </p>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "0.5rem",
                      fontSize: "0.8rem",
                      color: "#666",
                    }}
                  >
                    <span>
                      {new Date(photo.created_at).toLocaleString()} &middot;{" "}
                      {photo.recorded_by}
                      {isPrimary && (
                        <span
                          style={{
                            marginLeft: "0.5rem",
                            padding: "0.1rem 0.4rem",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            background: "#e8f5e9",
                            color: "#2e7d32",
                          }}
                        >
                          Primary
                        </span>
                      )}
                    </span>
                    {isAdmin && (
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        {!isPrimary && (
                          <button
                            onClick={() => handleSetPrimary(photo.id)}
                            style={{
                              padding: "0.2rem 0.5rem",
                              fontSize: "0.75rem",
                              border: "1px solid #a5d6a7",
                              borderRadius: "3px",
                              background: "#fff",
                              color: "#2e7d32",
                              cursor: "pointer",
                            }}
                          >
                            Set as Primary
                          </button>
                        )}
                        <button
                          onClick={() => handleDeletePhoto(photo.id)}
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
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div
        style={{
          width: "100%",
          padding: "1.25rem 1.5rem",
          borderRadius: "8px",
          border: "1px solid #ddd",
          background: "#fff",
        }}
      >
        <h2 style={{ fontSize: "1.125rem", marginBottom: "1rem" }}>
          Notes Log
        </h2>

        <form
          onSubmit={handleAddNote}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            marginBottom: "1.5rem",
          }}
        >
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Add a note (e.g. vet visit, medication)..."
            rows={3}
            disabled={adding}
            style={{
              width: "100%",
              padding: "0.5rem",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "0.9rem",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              disabled={adding}
              style={{
                padding: "0.4rem 0.5rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "0.9rem",
              }}
            />
            <button
              type="submit"
              disabled={adding || !newContent.trim()}
              style={{
                padding: "0.4rem 1rem",
                background: "#2e7d32",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                fontSize: "0.9rem",
                cursor: "pointer",
                opacity: adding || !newContent.trim() ? 0.6 : 1,
              }}
            >
              {adding ? "Adding..." : "Add Note"}
            </button>
          </div>
        </form>

        {error && (
          <p
            style={{
              color: "#d32f2f",
              fontSize: "0.85rem",
              marginBottom: "0.75rem",
            }}
          >
            {error}
          </p>
        )}

        {notes.length === 0 ? (
          <p style={{ color: "#999", fontSize: "0.9rem" }}>
            No notes yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {notes.map((note) => {
              const isEditing = editingNoteId === note.id;
              return (
                <div
                  key={note.id}
                  style={{
                    padding: "0.75rem 1rem",
                    border: "1px solid #e0e0e0",
                    borderRadius: "6px",
                    background: "#fafafa",
                  }}
                >
                  {isEditing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        disabled={saving}
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          border: "1px solid #1565c0",
                          borderRadius: "4px",
                          fontSize: "0.9rem",
                          resize: "vertical",
                          boxSizing: "border-box",
                        }}
                      />
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          disabled={saving}
                          style={{
                            padding: "0.3rem 0.5rem",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            fontSize: "0.85rem",
                          }}
                        />
                        <button
                          onClick={() => handleUpdateNote(note.id)}
                          disabled={saving || !editContent.trim()}
                          style={{
                            padding: "0.3rem 0.75rem",
                            background: "#1565c0",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            fontSize: "0.85rem",
                            cursor: "pointer",
                            opacity: saving || !editContent.trim() ? 0.6 : 1,
                          }}
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          style={{
                            padding: "0.3rem 0.75rem",
                            background: "#757575",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            fontSize: "0.85rem",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: "0.4rem",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "#666",
                            display: "flex",
                            gap: "0.75rem",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{note.date}</span>
                          <span>{note.recorded_by}</span>
                        </div>
                        {canModify(note) && (
                          <div style={{ display: "flex", gap: "0.3rem" }}>
                            <button
                              onClick={() => startEdit(note)}
                              style={{
                                padding: "0.15rem 0.4rem",
                                fontSize: "0.7rem",
                                border: "1px solid #ccc",
                                borderRadius: "3px",
                                background: "#fff",
                                cursor: "pointer",
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              style={{
                                padding: "0.15rem 0.4rem",
                                fontSize: "0.7rem",
                                border: "1px solid #ef9a9a",
                                borderRadius: "3px",
                                background: "#fff",
                                color: "#c62828",
                                cursor: "pointer",
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: "0.9rem",
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.5,
                        }}
                      >
                        {note.content}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
