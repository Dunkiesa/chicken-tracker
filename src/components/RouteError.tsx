"use client";

import { useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const isDev = process.env.NODE_ENV !== "production";

export default function RouteError({ error, reset }: RouteErrorProps) {
  useEffect(() => {
    if (isDev) {
      console.error("Route error boundary caught:", error);
    }
  }, [error]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        p: 2,
      }}
      role="alert"
    >
      <Container maxWidth="sm">
        <Alert severity="error">
          <AlertTitle>Something went wrong</AlertTitle>
          {isDev
            ? error.message
            : "An unexpected error occurred while loading this page."}
          {error.digest && (
            <Box sx={{ mt: 1, fontSize: "0.75rem", opacity: 0.7 }}>
              Reference: {error.digest}
            </Box>
          )}
        </Alert>
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
          <Button variant="contained" onClick={reset}>
            Try again
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}
