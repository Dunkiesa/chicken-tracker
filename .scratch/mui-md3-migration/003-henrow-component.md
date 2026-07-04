**Triage label:** `ready-for-agent`

## What to build

Migrate the HenRow component to MUI. This is a memoized table row component used in the Log Egg page to display a hen with a weight input. Replace all inline styles with MUI TableCell components and MUI styling. Preserve the React.memo wrapping for performance, as MUI components are heavier than raw HTML elements.

The component should render with MUI styling and maintain its memoization behavior.

## Acceptance criteria

- [ ] HenRow component uses MUI TableCell components instead of inline-styled td elements
- [ ] All inline styles replaced with MUI sx prop or theme tokens
- [ ] React.memo wrapping preserved
- [ ] Component renders correctly with MUI styling
- [ ] Memoization behavior verified (component does not re-render unnecessarily)

## Blocked by

- Issue 001 - Foundation & Theme Setup
