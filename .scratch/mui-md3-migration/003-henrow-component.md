**Triage label:** `ready-for-agent`

## What to build

Migrate the HenRow component to MUI. This is a memoized table row component used in the Log Egg page to display a hen with a weight input. Replace all inline styles with MUI TableCell components and MUI styling. Preserve the React.memo wrapping for performance, as MUI components are heavier than raw HTML elements.

The component should render with MUI styling and maintain its memoization behavior.

## Acceptance criteria

- [x] HenRow component uses MUI components (Box, Avatar, Typography, TextField) instead of inline-styled div/input elements
- [x] All inline styles replaced with MUI sx prop and theme tokens
- [x] React.memo wrapping preserved
- [x] Component renders correctly with MUI styling
- [x] Memoization behavior preserved (React.memo wrapping unchanged)

## Blocked by

- Issue 001 - Foundation & Theme Setup
