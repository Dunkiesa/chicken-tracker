"use client";
import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";

export default function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isAdmin = session?.user?.role === "Admin";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          padding: "0.4rem 0.75rem",
          background: "#f5f5f5",
          border: "1px solid #e0e0e0",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "0.875rem",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        <span>{session?.user?.email}</span>
        <span
          style={{
            padding: "0.1rem 0.4rem",
            borderRadius: "4px",
            fontSize: "0.75rem",
            fontWeight: 600,
            background: isAdmin ? "#e3f2fd" : "#f3e5f5",
            color: isAdmin ? "#1565c0" : "#7b1fa2",
          }}
        >
          {session?.user?.role}
        </span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "0.25rem",
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: "4px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            padding: "0.5rem",
            minWidth: "200px",
            zIndex: 10,
          }}
        >
          <div style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem", color: "#666" }}>
            {session?.user?.email}
          </div>
          <div style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem", marginBottom: "0.5rem" }}>
            <span
              style={{
                padding: "0.1rem 0.4rem",
                borderRadius: "4px",
                fontSize: "0.75rem",
                fontWeight: 600,
                background: isAdmin ? "#e3f2fd" : "#f3e5f5",
                color: isAdmin ? "#1565c0" : "#7b1fa2",
              }}
            >
              {session?.user?.role}
            </span>
          </div>
          <button
            onClick={() => signOut()}
            style={{
              width: "100%",
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
      )}
    </div>
  );
}
