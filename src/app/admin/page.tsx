"use client";

import { useSession, signIn } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type User = {
  email: string;
  role: string;
  created_at?: string;
};

type DynamicListEntry = {
  id: number;
  value: string;
};

type ListType = "breeds" | "origin-sources" | "acquisition-types";

const LIST_CONFIGS: { type: ListType; label: string; singular: string }[] = [
  { type: "breeds", label: "Breeds", singular: "Breed" },
  { type: "origin-sources", label: "Origin Sources", singular: "Origin Source" },
  { type: "acquisition-types", label: "Acquisition Types", singular: "Acquisition Type" },
];

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"Admin" | "Viewer">("Viewer");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [lists, setLists] = useState<Record<ListType, DynamicListEntry[]>>({
    breeds: [],
    "origin-sources": [],
    "acquisition-types": [],
  });

  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [renaming, setRenaming] = useState<Record<string, { id: number; value: string } | null>>({});
  const [mergeTargets, setMergeTargets] = useState<Record<string, Record<number, string>>>({});
  const [listErrors, setListErrors] = useState<Record<string, string | null>>({});

  const isAdmin = session?.user?.role === "Admin";

  async function fetchUsers() {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {
      // ignore
    }
  }

  const fetchList = useCallback(async (type: ListType) => {
    try {
      const res = await fetch(`/api/dynamic-lists/${type}`);
      if (res.ok) {
        const data = await res.json();
        setLists((prev) => ({ ...prev, [type]: data }));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("google");
      return;
    }
    if (status === "authenticated" && !isAdmin) {
      router.push("/");
      return;
    }
    if (isAdmin) {
      fetchUsers();
      LIST_CONFIGS.forEach((c) => fetchList(c.type));
    }
  }, [status, isAdmin, router, fetchList]);

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to add user");
        return;
      }

      setNewEmail("");
      await fetchUsers();
    } catch {
      setError("Failed to add user");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveUser(email: string) {
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        await fetchUsers();
      }
    } catch {
      // ignore
    }
  }

  async function handleRoleChange(email: string, newRole: "Admin" | "Viewer") {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: newRole }),
      });

      if (res.ok) {
        await fetchUsers();
      }
    } catch {
      // ignore
    }
  }

  async function handleAddValue(type: ListType) {
    const value = newValues[type]?.trim();
    if (!value) return;

    try {
      const res = await fetch(`/api/dynamic-lists/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });

      if (!res.ok) {
        const data = await res.json();
        setListErrors((prev) => ({ ...prev, [type]: data.message }));
        return;
      }

      setNewValues((prev) => ({ ...prev, [type]: "" }));
      setListErrors((prev) => ({ ...prev, [type]: null }));
      await fetchList(type);
    } catch {
      setListErrors((prev) => ({ ...prev, [type]: "Failed to add value" }));
    }
  }

  async function handleRename(type: ListType, id: number) {
    const entry = renaming[type];
    if (!entry || !entry.value.trim()) return;

    try {
      const res = await fetch(`/api/dynamic-lists/${type}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, value: entry.value.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setListErrors((prev) => ({ ...prev, [type]: data.message }));
        return;
      }

      setRenaming((prev) => ({ ...prev, [type]: null }));
      setListErrors((prev) => ({ ...prev, [type]: null }));
      await fetchList(type);
    } catch {
      setListErrors((prev) => ({ ...prev, [type]: "Failed to rename" }));
    }
  }

  async function handleRemove(type: ListType, id: number) {
    try {
      const res = await fetch(`/api/dynamic-lists/${type}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        const data = await res.json();
        setListErrors((prev) => ({ ...prev, [type]: data.message }));
        return;
      }

      setListErrors((prev) => ({ ...prev, [type]: null }));
      await fetchList(type);
    } catch {
      setListErrors((prev) => ({ ...prev, [type]: "Failed to remove" }));
    }
  }

  async function handleMerge(type: ListType, sourceId: number) {
    const targetId = parseInt(mergeTargets[type]?.[sourceId] ?? "", 10);
    if (!targetId || isNaN(targetId)) return;

    try {
      const res = await fetch(`/api/dynamic-lists/${type}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, targetId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setListErrors((prev) => ({ ...prev, [type]: data.message }));
        return;
      }

      setListErrors((prev) => ({ ...prev, [type]: null }));
      await fetchList(type);
    } catch {
      setListErrors((prev) => ({ ...prev, [type]: "Failed to merge" }));
    }
  }

  if (status === "loading") {
    return <p style={{ padding: "2rem", textAlign: "center" }}>Loading...</p>;
  }

  if (!isAdmin) {
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
      <h1 style={{ fontSize: "1.5rem" }}>Admin Panel</h1>

      {/* User Management */}
      <div
        style={{
          padding: "1.5rem 2rem",
          borderRadius: "8px",
          border: "1px solid #ddd",
          background: "#fff",
          width: "100%",
          maxWidth: "800px",
        }}
      >
        <h2 style={{ fontSize: "1.125rem", marginBottom: "1rem" }}>
          User Management
        </h2>
        <form
          onSubmit={handleAddUser}
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            marginBottom: "1rem",
          }}
        >
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="user@example.com"
            required
            disabled={adding}
            style={{
              flex: 1,
              minWidth: "200px",
              padding: "0.5rem",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "1rem",
            }}
          />
          <select
            value={newRole}
            onChange={(e) =>
              setNewRole(e.target.value as "Admin" | "Viewer")
            }
            disabled={adding}
            style={{
              padding: "0.5rem",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "1rem",
            }}
          >
            <option value="Viewer">Viewer</option>
            <option value="Admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={adding || !newEmail.trim()}
            style={{
              padding: "0.5rem 1rem",
              background: "#2e7d32",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontSize: "1rem",
              cursor: "pointer",
              opacity: adding || !newEmail.trim() ? 0.6 : 1,
            }}
          >
            {adding ? "Adding..." : "Add User"}
          </button>
        </form>
        {error && (
          <p style={{ color: "#d32f2f", marginBottom: "0.5rem" }}>{error}</p>
        )}
        {users.length === 0 ? (
          <p style={{ color: "#999" }}>No users added yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #eee" }}>
                <th style={{ textAlign: "left", padding: "0.5rem 0.5rem 0.5rem 0", fontWeight: 600 }}>Email</th>
                <th style={{ textAlign: "left", padding: "0.5rem", fontWeight: 600 }}>Role</th>
                <th style={{ textAlign: "right", padding: "0.5rem 0" }}></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "0.5rem 0.5rem 0.5rem 0" }}>{u.email}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.email, e.target.value as "Admin" | "Viewer")}
                      style={{
                        padding: "0.15rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        background: u.role === "Admin" ? "#e3f2fd" : "#f3e5f5",
                        color: u.role === "Admin" ? "#1565c0" : "#7b1fa2",
                        border: "1px solid",
                        borderColor: u.role === "Admin" ? "#1565c0" : "#7b1fa2",
                        cursor: "pointer",
                      }}
                    >
                      <option value="Viewer">Viewer</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </td>
                  <td style={{ textAlign: "right", padding: "0.5rem 0" }}>
                    {u.email !== session?.user?.email && (
                      <button
                        onClick={() => handleRemoveUser(u.email)}
                        style={{
                          padding: "0.25rem 0.5rem",
                          background: "none",
                          color: "#d32f2f",
                          border: "1px solid #d32f2f",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Dynamic Lists Management */}
      {LIST_CONFIGS.map((config) => {
        const type = config.type;
        const entries = lists[type] || [];
        const renamingEntry = renaming[type];
        const errorMsg = listErrors[type];

        return (
          <div
            key={type}
            style={{
              padding: "1.5rem 2rem",
              borderRadius: "8px",
              border: "1px solid #ddd",
              background: "#fff",
              width: "100%",
              maxWidth: "800px",
            }}
          >
            <h2 style={{ fontSize: "1.125rem", marginBottom: "1rem" }}>
              {config.label}
            </h2>

            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
              <input
                type="text"
                value={newValues[type] || ""}
                onChange={(e) =>
                  setNewValues((prev) => ({ ...prev, [type]: e.target.value }))
                }
                placeholder={`New ${config.singular.toLowerCase()}...`}
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "1rem",
                }}
              />
              <button
                onClick={() => handleAddValue(type)}
                disabled={!newValues[type]?.trim()}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#2e7d32",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "1rem",
                  cursor: "pointer",
                  opacity: !newValues[type]?.trim() ? 0.6 : 1,
                }}
              >
                Add
              </button>
            </div>

            {errorMsg && (
              <p style={{ color: "#d32f2f", marginBottom: "0.5rem", fontSize: "0.875rem" }}>
                {errorMsg}
              </p>
            )}

            {entries.length === 0 ? (
              <p style={{ color: "#999", fontSize: "0.875rem" }}>
                No {config.label.toLowerCase()} defined yet.
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #eee" }}>
                    <th style={{ textAlign: "left", padding: "0.5rem 0.5rem 0.5rem 0", fontWeight: 600 }}>Value</th>
                    <th style={{ textAlign: "left", padding: "0.5rem", fontWeight: 600 }}>Merge Into</th>
                    <th style={{ textAlign: "right", padding: "0.5rem 0" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const isRenaming = renamingEntry?.id === entry.id;
                    return (
                      <tr key={entry.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "0.5rem 0.5rem 0.5rem 0" }}>
                          {isRenaming ? (
                            <input
                              type="text"
                              value={renamingEntry?.value || ""}
                              onChange={(e) =>
                                setRenaming((prev) => ({
                                  ...prev,
                                  [type]: { id: entry.id, value: e.target.value },
                                }))
                              }
                              autoFocus
                              style={{
                                padding: "0.25rem 0.5rem",
                                border: "1px solid #1565c0",
                                borderRadius: "4px",
                                fontSize: "0.9rem",
                                width: "100%",
                              }}
                            />
                          ) : (
                            <span>{entry.value}</span>
                          )}
                        </td>
                        <td style={{ padding: "0.5rem" }}>
                          <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                            <select
                              value={mergeTargets[type]?.[entry.id] || ""}
                              onChange={(e) =>
                                setMergeTargets((prev) => ({
                                  ...prev,
                                  [type]: {
                                    ...(prev[type] || {}),
                                    [entry.id]: e.target.value,
                                  },
                                }))
                              }
                              style={{
                                flex: 1,
                                padding: "0.25rem",
                                border: "1px solid #ccc",
                                borderRadius: "4px",
                                fontSize: "0.8rem",
                              }}
                            >
                              <option value="">Select target...</option>
                              {entries
                                .filter((e) => e.id !== entry.id)
                                .map((e) => (
                                  <option key={e.id} value={e.id}>
                                    {e.value}
                                  </option>
                                ))}
                            </select>
                            <button
                              onClick={() => handleMerge(type, entry.id)}
                              disabled={!mergeTargets[type]?.[entry.id]}
                              style={{
                                padding: "0.25rem 0.5rem",
                                background: "#f57f17",
                                color: "#fff",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                                opacity: !mergeTargets[type]?.[entry.id] ? 0.5 : 1,
                                whiteSpace: "nowrap",
                              }}
                            >
                              Merge
                            </button>
                          </div>
                        </td>
                        <td style={{ textAlign: "right", padding: "0.5rem 0" }}>
                          <div style={{ display: "flex", gap: "0.25rem", justifyContent: "flex-end" }}>
                            {isRenaming ? (
                              <>
                                <button
                                  onClick={() => handleRename(type, entry.id)}
                                  disabled={!renamingEntry?.value.trim()}
                                  style={{
                                    padding: "0.25rem 0.5rem",
                                    background: "#1565c0",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "0.75rem",
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() =>
                                    setRenaming((prev) => ({ ...prev, [type]: null }))
                                  }
                                  style={{
                                    padding: "0.25rem 0.5rem",
                                    background: "#757575",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "0.75rem",
                                  }}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() =>
                                    setRenaming((prev) => ({
                                      ...prev,
                                      [type]: { id: entry.id, value: entry.value },
                                    }))
                                  }
                                  style={{
                                    padding: "0.25rem 0.5rem",
                                    background: "none",
                                    color: "#1565c0",
                                    border: "1px solid #1565c0",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "0.75rem",
                                  }}
                                >
                                  Rename
                                </button>
                                <button
                                  onClick={() => handleRemove(type, entry.id)}
                                  style={{
                                    padding: "0.25rem 0.5rem",
                                    background: "none",
                                    color: "#d32f2f",
                                    border: "1px solid #d32f2f",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "0.75rem",
                                  }}
                                >
                                  Remove
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </main>
  );
}
