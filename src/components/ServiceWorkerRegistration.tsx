"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Snackbar } from "@mui/material";

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export default function ServiceWorkerRegistration() {
  const [updateReady, setUpdateReady] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const applyUpdate = useCallback(() => {
    const sw = registrationRef.current;
    if (sw?.waiting) {
      sw.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onLoad = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        registrationRef.current = reg;

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(true);
            }
          });
        });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          window.location.reload();
        });

        setInterval(() => {
          reg.update();
        }, UPDATE_CHECK_INTERVAL_MS);
      } catch {
        // registration failed silently
      }
    };

    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad);
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  const handleClose = (_: unknown, reason?: string) => {
    if (reason === "clickaway") return;
  };

  return (
    <Snackbar
      open={updateReady}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      onClose={handleClose}
    >
      <Alert
        severity="info"
        variant="filled"
        sx={{
          width: "100%",
          alignItems: "center",
          "& .MuiAlert-message": { width: "100%" },
        }}
        action={
          <Button color="inherit" size="small" onClick={applyUpdate}>
            Reload
          </Button>
        }
      >
        New version available
      </Alert>
    </Snackbar>
  );
}
