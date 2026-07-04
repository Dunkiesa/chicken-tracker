import { createTheme, Theme } from "@mui/material/styles";
import { getLightPalette, getDarkPalette } from "./palette";

export function createMD3Theme(mode: "light" | "dark"): Theme {
  const palette = mode === "light" ? getLightPalette() : getDarkPalette();

  return createTheme({
    palette: {
      mode,
      primary: {
        main: palette.primary,
        light: palette.primaryContainer,
        dark: palette.onPrimaryContainer,
        contrastText: palette.onPrimary,
      },
      secondary: {
        main: palette.secondary,
        light: palette.secondaryContainer,
        dark: palette.onSecondaryContainer,
        contrastText: palette.onSecondary,
      },
      error: {
        main: palette.error,
        light: palette.errorContainer,
        dark: palette.onErrorContainer,
        contrastText: palette.onError,
      },
      background: {
        default: palette.background,
        paper: palette.surface,
      },
      text: {
        primary: palette.onSurface,
        secondary: palette.onSurfaceVariant,
        disabled: palette.outline,
      },
      divider: palette.outlineVariant,
      action: {
        active: palette.onSurfaceVariant,
        hover: palette.surfaceVariant,
        selected: palette.secondaryContainer,
        disabled: palette.outline,
        disabledBackground: palette.surfaceVariant,
      },
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontSize: "3.5625rem",
        fontWeight: 400,
        lineHeight: 1.12,
        letterSpacing: "-0.25px",
      },
      h2: {
        fontSize: "2.8125rem",
        fontWeight: 400,
        lineHeight: 1.16,
        letterSpacing: 0,
      },
      h3: {
        fontSize: "2.25rem",
        fontWeight: 400,
        lineHeight: 1.22,
        letterSpacing: 0,
      },
      h4: {
        fontSize: "2rem",
        fontWeight: 400,
        lineHeight: 1.25,
        letterSpacing: 0,
      },
      h5: {
        fontSize: "1.5rem",
        fontWeight: 400,
        lineHeight: 1.33,
        letterSpacing: 0,
      },
      h6: {
        fontSize: "1.375rem",
        fontWeight: 500,
        lineHeight: 1.27,
        letterSpacing: 0,
      },
      subtitle1: {
        fontSize: "1rem",
        fontWeight: 500,
        lineHeight: 1.5,
        letterSpacing: "0.15px",
      },
      subtitle2: {
        fontSize: "0.875rem",
        fontWeight: 500,
        lineHeight: 1.43,
        letterSpacing: "0.1px",
      },
      body1: {
        fontSize: "1rem",
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: "0.5px",
      },
      body2: {
        fontSize: "0.875rem",
        fontWeight: 400,
        lineHeight: 1.43,
        letterSpacing: "0.25px",
      },
      button: {
        fontSize: "0.875rem",
        fontWeight: 500,
        lineHeight: 1.43,
        letterSpacing: "0.1px",
        textTransform: "none",
      },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 20,
            textTransform: "none",
            fontWeight: 500,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow:
              mode === "light"
                ? "0px 1px 3px rgba(0,0,0,0.12), 0px 1px 2px rgba(0,0,0,0.08)"
                : "0px 1px 3px rgba(0,0,0,0.3), 0px 1px 2px rgba(0,0,0,0.2)",
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: 8,
            },
          },
        },
      },
    },
  });
}
