export default function AuthErrorPage() {
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
        Authentication Error
      </h1>
      <p style={{ color: "#666", maxWidth: "480px" }}>
        Something went wrong during sign-in. Please try again.
      </p>
      <a
        href="/"
        style={{
          marginTop: "1.5rem",
          padding: "0.5rem 1rem",
          background: "#2e7d32",
          color: "#fff",
          textDecoration: "none",
          borderRadius: "4px",
        }}
      >
        Back to Home
      </a>
    </main>
  );
}
