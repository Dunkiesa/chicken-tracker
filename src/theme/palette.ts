import {
  argbFromHex,
  themeFromSourceColor,
  Theme,
} from "@material/material-color-utilities";

const SOURCE_COLOR = "#AE9965";

export interface MD3Palette {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  warning: string;
  onWarning: string;
  warningContainer: string;
  onWarningContainer: string;
  success: string;
  onSuccess: string;
  successContainer: string;
  onSuccessContainer: string;
  info: string;
  onInfo: string;
  infoContainer: string;
  onInfoContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  shadow: string;
  scrim: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
}

function hexFromArgb(argb: number): string {
  const r = (argb >> 16) & 0xff;
  const g = (argb >> 8) & 0xff;
  const b = argb & 0xff;
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function extractPalette(theme: Theme, isDark: boolean): MD3Palette {
  const scheme = isDark ? theme.schemes.dark : theme.schemes.light;

  return {
    primary: hexFromArgb(scheme.primary),
    onPrimary: hexFromArgb(scheme.onPrimary),
    primaryContainer: hexFromArgb(scheme.primaryContainer),
    onPrimaryContainer: hexFromArgb(scheme.onPrimaryContainer),
    secondary: hexFromArgb(scheme.secondary),
    onSecondary: hexFromArgb(scheme.onSecondary),
    secondaryContainer: hexFromArgb(scheme.secondaryContainer),
    onSecondaryContainer: hexFromArgb(scheme.onSecondaryContainer),
    tertiary: hexFromArgb(scheme.tertiary),
    onTertiary: hexFromArgb(scheme.onTertiary),
    tertiaryContainer: hexFromArgb(scheme.tertiaryContainer),
    onTertiaryContainer: hexFromArgb(scheme.onTertiaryContainer),
    error: hexFromArgb(scheme.error),
    onError: hexFromArgb(scheme.onError),
    errorContainer: hexFromArgb(scheme.errorContainer),
    onErrorContainer: hexFromArgb(scheme.onErrorContainer),
    warning: isDark ? "#FFB300" : "#F9A825",
    onWarning: isDark ? "#422C00" : "#FFFFFF",
    warningContainer: isDark ? "#5F4200" : "#FFF3E0",
    onWarningContainer: isDark ? "#FFDDB1" : "#4E3600",
    success: isDark ? "#70C060" : "#4CAF50",
    onSuccess: isDark ? "#003A07" : "#FFFFFF",
    successContainer: isDark ? "#005410" : "#E8F5E9",
    onSuccessContainer: isDark ? "#8FDB8A" : "#1B5E20",
    info: isDark ? "#70B8FF" : "#2196F3",
    onInfo: isDark ? "#003258" : "#FFFFFF",
    infoContainer: isDark ? "#004A7C" : "#E3F2FD",
    onInfoContainer: isDark ? "#C8E1FF" : "#0D47A1",
    background: hexFromArgb(scheme.background),
    onBackground: hexFromArgb(scheme.onBackground),
    surface: hexFromArgb(scheme.surface),
    onSurface: hexFromArgb(scheme.onSurface),
    surfaceVariant: hexFromArgb(scheme.surfaceVariant),
    onSurfaceVariant: hexFromArgb(scheme.onSurfaceVariant),
    outline: hexFromArgb(scheme.outline),
    outlineVariant: hexFromArgb(scheme.outlineVariant),
    shadow: hexFromArgb(scheme.shadow),
    scrim: hexFromArgb(scheme.scrim),
    inverseSurface: hexFromArgb(scheme.inverseSurface),
    inverseOnSurface: hexFromArgb(scheme.inverseOnSurface),
    inversePrimary: hexFromArgb(scheme.inversePrimary),
  };
}

let cachedLightPalette: MD3Palette | null = null;
let cachedDarkPalette: MD3Palette | null = null;

export function getLightPalette(): MD3Palette {
  if (!cachedLightPalette) {
    const theme = themeFromSourceColor(argbFromHex(SOURCE_COLOR));
    cachedLightPalette = extractPalette(theme, false);
  }
  return cachedLightPalette;
}

export function getDarkPalette(): MD3Palette {
  if (!cachedDarkPalette) {
    const theme = themeFromSourceColor(argbFromHex(SOURCE_COLOR));
    cachedDarkPalette = extractPalette(theme, true);
  }
  return cachedDarkPalette;
}
