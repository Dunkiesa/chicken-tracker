"use client";
import { useSession } from "next-auth/react";

export default function NavMenu() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "Admin";

  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
      <a
        href="/log-egg"
        style={{
          padding: "0.4rem 0.75rem",
          background: "#2e7d32",
          color: "#fff",
          borderRadius: "4px",
          textDecoration: "none",
          fontSize: "0.875rem",
          fontWeight: 600,
        }}
      >
        Log
      </a>
      {isAdmin && (
        <a
          href="/"
          style={{
            padding: "0.4rem 0.75rem",
            background: "#f57c00",
            color: "#fff",
            borderRadius: "4px",
            textDecoration: "none",
            fontSize: "0.875rem",
          }}
        >
          Enroll
        </a>
      )}
      <a
        href="/dashboard"
        style={{
          padding: "0.4rem 0.75rem",
          background: "#6a1b9a",
          color: "#fff",
          borderRadius: "4px",
          textDecoration: "none",
          fontSize: "0.875rem",
        }}
      >
        Dashboard
      </a>
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
          Admin
        </a>
      )}
    </div>
  );
}
