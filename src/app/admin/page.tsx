"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  email: string;
  role: string;
  created_at?: string;
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"Admin" | "Viewer">("Viewer");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const isAdmin = session?.user?.role === "Admin";

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
    }
  }, [status, isAdmin, router]);

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

  async function handleAdd(e: React.FormEvent) {
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

  async function handleRemove(email: string) {
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          maxWidth: "700px",
        }}
      >
        <h1 style={{ fontSize: "1.5rem" }}>User Management</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ color: "#666", fontSize: "0.875rem" }}>
            {session?.user?.email}
          </span>
          <a
            href="/"
            style={{
              padding: "0.4rem 0.75rem",
              background: "#e0e0e0",
              borderRadius: "4px",
              textDecoration: "none",
              color: "#333",
              fontSize: "0.875rem",
            }}
          >
            Home
          </a>
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
        </div>
      </div>

      <div
        style={{
          padding: "1.5rem 2rem",
          borderRadius: "8px",
          border: "1px solid #ddd",
          background: "#fff",
          width: "100%",
          maxWidth: "700px",
        }}
      >
        <h2 style={{ fontSize: "1.125rem", marginBottom: "1rem" }}>
          Add User
        </h2>
        <form
          onSubmit={handleAdd}
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
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
          <p style={{ color: "#d32f2f", marginTop: "0.5rem" }}>{error}</p>
        )}
      </div>

      <div
        style={{
          padding: "1.5rem 2rem",
          borderRadius: "8px",
          border: "1px solid #ddd",
          background: "#fff",
          width: "100%",
          maxWidth: "700px",
        }}
      >
        <h2 style={{ fontSize: "1.125rem", marginBottom: "1rem" }}>
          Allowed Users ({users.length})
        </h2>
        {users.length === 0 ? (
          <p style={{ color: "#999" }}>No users added yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #eee" }}>
                <th
                  style={{
                    textAlign: "left",
                    padding: "0.5rem 0.5rem 0.5rem 0",
                    fontWeight: 600,
                  }}
                >
                  Email
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "0.5rem",
                    fontWeight: 600,
                  }}
                >
                  Role
                </th>
                <th style={{ textAlign: "right", padding: "0.5rem 0" }}></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "0.5rem 0.5rem 0.5rem 0" }}>
                    {u.email}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <span
                      style={{
                        padding: "0.15rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        background:
                          u.role === "Admin" ? "#e3f2fd" : "#f3e5f5",
                        color: u.role === "Admin" ? "#1565c0" : "#7b1fa2",
                      }}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", padding: "0.5rem 0" }}>
                    {u.email !== session?.user?.email && (
                      <button
                        onClick={() => handleRemove(u.email)}
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
    </main>
  );
}
