export default function UnauthorizedPage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
        Not Authorized
      </h1>
      <p style={{ color: "#666", maxWidth: "480px" }}>
        Your Google account was authenticated, but your email is not in the
        allowlist for this app. Contact an admin to gain access.
      </p>
      <a
        href="/api/auth/signout"
        style={{
          marginTop: "1.5rem",
          padding: "0.5rem 1rem",
          background: "#d32f2f",
          color: "#fff",
          textDecoration: "none",
          borderRadius: "4px",
        }}
      >
        Sign Out
      </a>
    </main>
  );
}
