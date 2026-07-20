"use client";

import { Suspense, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
} from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";

export default function Home() {
  return (
    <Suspense
      fallback={
        <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      }
    >
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/log-egg");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (status === "unauthenticated") {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 2,
        }}
      >
        <Typography variant="h3" fontWeight={700}>
          ChickenTrack
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400, textAlign: "center" }}>
          Egg-production tracking for your backyard flock
        </Typography>
        <Button variant="contained" onClick={() => signIn("google")} aria-label="Sign in with Google" sx={{ mt: 1, minWidth: 0, p: 1.5 }}>
          <LoginIcon />
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
      <CircularProgress />
    </Box>
  );
}
