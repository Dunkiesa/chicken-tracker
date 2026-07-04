**Triage label:** `ready-for-agent`

## What to build

Migrate the AppShell component and all navigation elements to MUI. Replace the current inline-styled header, nav menu, user menu, and system status footer with MUI components.

The AppShell becomes a MUI AppBar (top bar) with the app title, a health indicator icon, a theme toggle button, and a user menu button. The navigation becomes a persistent mini-drawer on desktop (collapsed to ~80px rail showing icons only, expands to ~240px on hover showing icons + labels) and a modal drawer on mobile. Nav items are Dashboard, Roster, Log Egg, and Admin (Admin-only), each with appropriate MUI icons and active route highlighting.

The UserMenu becomes a MUI Menu anchored to an IconButton in the AppBar, showing user name/email, role badge, divider, and sign-out option.

Create a new HealthIndicator component that replaces the SystemStatusFooter. It shows a small icon in the AppBar (green checkmark when healthy, red warning when unhealthy) that fetches the health endpoint periodically. On error, it shows a MUI Snackbar with the error message.

## Acceptance criteria

- [ ] AppBar renders with app title, health indicator, theme toggle, and user menu button
- [ ] Persistent mini-drawer renders on desktop with ~80px rail width
- [ ] Drawer expands to ~240px on hover showing icons + labels
- [ ] Drawer becomes modal drawer on mobile with hamburger menu
- [ ] All nav items (Dashboard, Roster, Log Egg, Admin) render with MUI icons
- [ ] Admin nav item only visible to Admin users
- [ ] Active route is visually highlighted in navigation
- [ ] UserMenu opens as MUI Menu with user info, role badge, and sign-out
- [ ] Theme toggle button opens menu with system/light/dark options
- [ ] HealthIndicator shows green checkmark when system is healthy
- [ ] HealthIndicator shows red warning icon when system is unhealthy
- [ ] Snackbar appears with error message when health check fails
- [ ] SystemStatusFooter removed from codebase
- [ ] All inline styles replaced with MUI components and sx prop

## Blocked by

- Issue 001 - Foundation & Theme Setup
