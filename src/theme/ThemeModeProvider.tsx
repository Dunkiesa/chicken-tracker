"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { createMD3Theme } from "./theme";

type ThemeMode = "system" | "light" | "dark";

interface ThemeModeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedMode: "light" | "dark";
  sourceColor: string;
  setSourceColor: (color: string) => void;
}

const ThemeModeContext = createContext<ThemeModeContextType | undefined>(
  undefined
);

const STORAGE_KEY = "chickentrack-theme-mode";
const COLOR_STORAGE_KEY = "chickentrack-theme-color";
const DEFAULT_SOURCE_COLOR = "#AE9965";

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);
  const [sourceColor, setSourceColorState] = useState(DEFAULT_SOURCE_COLOR);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored && ["system", "light", "dark"].includes(stored)) {
      setModeState(stored);
    }
    const storedColor = localStorage.getItem(COLOR_STORAGE_KEY);
    if (storedColor) {
      setSourceColorState(storedColor);
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemPrefersDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const resolvedMode: "light" | "dark" =
    mode === "system" ? (systemPrefersDark ? "dark" : "light") : mode;

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  const setSourceColor = useCallback((color: string) => {
    setSourceColorState(color);
    localStorage.setItem(COLOR_STORAGE_KEY, color);
  }, []);

  const theme = useMemo(
    () => createMD3Theme(resolvedMode, sourceColor),
    [resolvedMode, sourceColor]
  );

  const contextValue = useMemo(
    () => ({ mode, setMode, resolvedMode, sourceColor, setSourceColor }),
    [mode, setMode, resolvedMode, sourceColor, setSourceColor]
  );

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeContextType {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within a ThemeModeProvider");
  }
  return context;
}
