"use client";

import { useEffect } from "react";

const isDev = process.env.NODE_ENV !== "production";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    if (isDev) {
      console.error("Global error boundary caught:", error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            '"Roboto", "Helvetica", "Arial", sans-serif',
          backgroundColor: "#fafafa",
          color: "#1c1b1f",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: 16,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              maxWidth: 480,
              width: "100%",
              padding: 16,
              border: "1px solid #f5c6c6",
              borderRadius: 8,
              backgroundColor: "#fdecea",
              color: "#5f2120",
            }}
            role="alert"
          >
            <h2 style={{ margin: "0 0 8px 0", fontSize: "1.25rem" }}>
              Something went wrong
            </h2>
            <p style={{ margin: 0 }}>
              {isDev
                ? error.message
                : "An unexpected error occurred. Please try again."}
            </p>
            {error.digest && (
              <p style={{ margin: "8px 0 0 0", fontSize: "0.75rem", opacity: 0.7 }}>
                Reference: {error.digest}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              border: "none",
              borderRadius: 20,
              backgroundColor: "#6750a4",
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
