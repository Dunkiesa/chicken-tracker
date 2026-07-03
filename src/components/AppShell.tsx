"use client";
import { useSession, signIn } from "next-auth/react";
import NavMenu from "./NavMenu";
import UserMenu from "./UserMenu";
import SystemStatusFooter from "./SystemStatusFooter";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.75rem 1.5rem",
          background: "#fff",
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        <a
          href="/"
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "#333",
            textDecoration: "none",
          }}
        >
          ChickenTrack
        </a>
        {status === "authenticated" && <NavMenu />}
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
        {status === "authenticated" && <UserMenu />}
      </header>
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {children}
      </main>
      <SystemStatusFooter />
    </div>
  );
}
