**Triage label:** `ready-for-agent`

## What to build

Install MUI v6 and all supporting dependencies. Generate the MD3 color palette from source color #AE9965 using the HCT color space algorithm for both light and dark modes. Create the ThemeModeProvider React context that holds the current theme mode (system/light/dark) with localStorage persistence. Update the root layout to wrap the app in the provider hierarchy: SessionProvider → ThemeModeProvider → MUI ThemeProvider → CssBaseline → QueryClientProvider → AppShell. Disable component tests via Jest config `testPathIgnorePatterns` to prevent test failures during migration.

The app should load with the MUI ThemeProvider active, though no visible UI changes yet since components haven't been migrated.

## Acceptance criteria

- [ ] MUI v6, Emotion, MUI Icons, MUI Date Pickers, React Hook Form, Zod, TanStack Query, TanStack Table installed
- [ ] MD3 palette generated from #AE9965 with all color roles (primary, secondary, tertiary, error, surface, etc.) for light and dark modes
- [ ] Theme configuration includes MD3 typography scale, shape scale, and simplified drop-shadow elevation
- [ ] ThemeModeProvider context created with localStorage persistence for theme preference
- [ ] useThemeMode() hook exported for components to access and toggle theme
- [ ] Root layout updated with full provider hierarchy
- [ ] CssBaseline included to apply theme colors and reset defaults
- [ ] Component tests disabled in Jest config via testPathIgnorePatterns
- [ ] App loads without errors and theme can be toggled programmatically

## Blocked by

None - can start immediately
