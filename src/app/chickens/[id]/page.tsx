"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";

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
  created_at: string;
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

  const [newContent, setNewContent] = useState("");
  const [newDate, setNewDate] = useState(todayStr());
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);

  const isAdmin = session?.user?.role === "Admin";

  const fetchData = useCallback(async () => {
    if (isNaN(chickenId)) return;
    try {
      const [chickenRes, notesRes] = await Promise.all([
        fetch(`/api/chickens/${chickenId}`),
        fetch(`/api/chickens/${chickenId}/notes`),
      ]);
      if (chickenRes.ok) setChicken(await chickenRes.json());
      if (notesRes.ok) setNotes(await notesRes.json());
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
    }
  }, [status, chickenId, fetchData, router]);

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
        }}
      >
        <h1 style={{ fontSize: "1.5rem" }}>{chicken.name}</h1>
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
