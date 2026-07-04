# MUI Material Design 3 Migration

**Triage label:** `ready-for-agent`

## Problem Statement

ChickenTrack's UI is built entirely with hand-coded inline styles — no component library, no CSS framework, no theming system. The same card, button, table, badge, and input patterns are duplicated as inline style objects across every page and component file. This creates three problems:

1. **Visual design is inconsistent and unpolished.** Every element is hand-rolled with hardcoded hex colors and pixel values. There is no design system, no type scale, no elevation system, and no dark mode. The app looks like a prototype, not a finished product.

2. **Developer experience is poor.** Adding or modifying UI means copying and pasting inline style objects between files. There are no shared abstractions. Common patterns (card containers, primary buttons, danger buttons, inputs, tables, status badges) are redefined independently in every file that needs them.

3. **Mobile UX is suboptimal.** The Log Egg page — the most time-sensitive screen, used at the coop on a phone — renders hens as a table row grid, which is awkward on small screens. The entire app lacks responsive design beyond basic inline style adjustments.

## Solution

Migrate the entire UI to **MUI v6** with a **Material Design 3** theme. The migration is incremental: the app shell (AppBar, navigation drawer, theme toggle, health indicator) is migrated first, then pages are migrated one at a time in priority order. All inline styles are replaced with MUI components, MUI's `sx` prop, `styled()` API, and theme tokens. The migration also introduces proper form handling (React Hook Form + Zod), data fetching (TanStack Query), and responsive layout (MUI Grid/Stack/Container).

The MD3 theme uses a dynamic color palette generated from source color **#AE9965**, with full light and dark mode support and a 3-way toggle (system/light/dark).

## User Stories

### Theme & Appearance

1. As a user, I want the app to use a cohesive Material Design 3 visual language, so that it looks polished and professional.
2. As a user, I want the app to have a warm, earthy color palette (derived from #AE9965), so that it feels appropriate for a backyard chicken app.
3. As a user, I want the app to support dark mode, so that I can use it comfortably at night or in low-light conditions.
4. As a user, I want a 3-way theme toggle (system/light/dark), so that I can choose between automatic system preference or a fixed mode.
5. As a user, I want my theme preference to persist across browser sessions, so that I don't have to re-select it every time.
6. As a user, I want the MD3 type scale (Display, Headline, Title, Body, Label) applied consistently, so that text hierarchy is clear throughout the app.
7. As a user, I want consistent corner radii and elevation across all components, so that the UI feels unified.

### Navigation & Shell

8. As a user, I want a persistent navigation drawer on desktop, so that I can see all navigation options at a glance.
9. As a user, I want the navigation drawer to collapse to a narrow rail on desktop, so that it doesn't waste screen space.
10. As a user, I want the navigation drawer to expand on hover, so that I can see labels when I need them.
11. As a user, I want navigation items to show icons, so that I can identify sections quickly.
12. As a user, I want the active navigation item to be visually highlighted, so that I always know where I am.
13. As a user, I want the Admin navigation item to only appear for Admin users, so that Viewers don't see options they can't use.
14. As a user, I want a system health indicator in the app bar, so that I can see at a glance whether the system is healthy.
15. As a user, I want error Snackbars to appear when something goes wrong, so that I'm informed of problems without a persistent footer.
16. As a user, I want a user menu in the app bar showing my name, email, and role, so that I know which account I'm signed in as.
17. As a user, I want a sign-out option in the user menu, so that I can end my session.
18. As a user, I want the theme toggle in the app bar, so that I can switch themes from anywhere in the app.

### Log Egg Page (Mobile Priority)

19. As a Viewer, I want the Log Egg page to show hens as a vertical stack of cards on mobile, so that I can easily tap weight inputs on a small screen.
20. As a Viewer, I want each hen card to show the hen's primary photo, name, and a weight input, so that I can quickly identify the bird and log its egg.
21. As a Viewer, I want a date picker at the top of the Log Egg page, so that I can log eggs for a specific date.
22. As a Viewer, I want weight inputs to validate on blur (20-200g range), so that I catch typos immediately.
23. As a Viewer, I want to submit all eggs in a single batch, so that logging is fast.
24. As a Viewer, I want loading and error states to be clearly shown, so that I know when the submission is in progress or has failed.
25. As an Admin, I want the Log Egg page to work well on desktop too, so that I can use it from any device.
26. As a user, I want Roosters to be hidden from the egg picker by default, so that I don't accidentally log eggs for non-laying birds.
27. As a user, I want a "show all" toggle to include Roosters, so that I can override the default when needed.
28. As a user, I want Departed birds to be hidden from the egg picker by default, so that I don't log eggs for birds that are no longer in the flock.

### Roster Page

29. As a user, I want the chicken roster displayed as a sortable, filterable table, so that I can find specific birds quickly.
30. As a user, I want each row to show the hen's primary photo thumbnail, name, sex badge, and breed, so that I can identify birds at a glance.
31. As a user, I want to click a row to navigate to the chicken's profile, so that I can see full details.
32. As an Admin, I want an enrollment form to add new chickens, so that I can register new birds.
33. As an Admin, I want the enrollment form to use autocomplete for breed, origin source, and acquisition type, so that I can pick from existing values or add new ones.
34. As an Admin, I want form validation to show inline errors on blur, so that I can correct mistakes as I fill in the form.
35. As a user, I want a "show departed" toggle, so that I can include or exclude departed birds from the list.

### Dashboard Page

36. As a user, I want the dashboard metrics displayed as a grid of cards, so that the information is scannable.
37. As a user, I want a date range selector on the dashboard, so that I can filter metrics to a specific period.
38. As a user, I want production over time displayed as a text table, so that I can see egg counts per day/week/month.
39. As a user, I want average egg weight displayed per hen and flock-wide, so that I can track egg size trends.
40. As a user, I want egg weight variance (min/max/std dev) per hen, so that I can see consistency.
41. As a user, I want hens ranked by egg count (most productive), so that I can see which birds are laying best.
42. As a user, I want production consistency (laying rate as a percentage) per hen, so that I can compare reliability.
43. As a user, I want dry period alerts prominently displayed, so that I can spot broodiness or molting early.
44. As a user, I want seasonal trends displayed by calendar month/season, so that I can see year-over-year patterns.
45. As a user, I want attrition displayed as a by-reason breakdown, so that I can understand why birds leave the flock.
46. As a user, I want all metrics to respect the date range selector, so that I can focus on the period I care about.
47. As a user, I want departed birds' history to count within their active periods, so that metrics remain accurate.

### Chicken Profile Page

48. As a user, I want the chicken profile to show the bird's photo, name, sex, breed, origin, acquisition details, and status, so that I have a complete view of the bird.
49. As a user, I want the photos displayed as an ImageList grid, so that I can browse all photos of the bird visually.
50. As a user, I want to click a photo to view it full size in a dialog, so that I can see details.
51. As an Admin, I want to upload a new photo with a description, so that I can add to the bird's photo history.
52. As an Admin, I want to set a photo as the primary photo, so that it appears in lists and the egg picker.
53. As an Admin, I want to delete a photo, so that I can remove unwanted images.
54. As a user, I want the notes displayed as a chronological list, so that I can see the bird's history in order.
55. As an Admin, I want to add a new note with a date and content, so that I can record vet visits, medications, etc.
56. As an Admin, I want to edit an existing note, so that I can correct mistakes.
57. As an Admin, I want to delete a note, so that I can remove incorrect entries.
58. As an Admin, I want to edit the chicken's details (name, sex, breed, origin, acquisition, departure), so that I can keep the profile up to date.
59. As an Admin, I want to mark a chicken as departed with a date and reason, so that I can track attrition.
60. As a user, I want sex badges to be visually distinct (Hen=pink, Rooster=blue, Unknown=purple), so that I can quickly identify bird types.
61. As a user, I want departure status to be clearly indicated, so that I know which birds are no longer in the flock.

### Admin Page

62. As an Admin, I want a user management section showing all users with their emails and roles, so that I can see who has access.
63. As an Admin, I want to add a new user by email with a role (Admin/Viewer), so that I can grant access.
64. As an Admin, I want to change a user's role, so that I can adjust permissions.
65. As an Admin, I want to remove a user, so that I can revoke access.
66. As an Admin, I want to manage dynamic lists (breeds, origin sources, acquisition types), so that I can rename, remove, or merge values.
67. As an Admin, I want the admin page organized with tabs for different sections, so that I can navigate between user management and list management easily.
68. As an Admin, I want all admin forms to validate on blur with inline errors, so that I can correct mistakes quickly.

### Error Pages

69. As a user, I want the unauthorized page to clearly explain that I don't have access, so that I understand why I can't use the app.
70. As a user, I want a button to go home from error pages, so that I can navigate away easily.
71. As a user, I want the auth error page to explain what went wrong with authentication, so that I can troubleshoot.

### Data Fetching & Performance

72. As a user, I want data to be cached so that navigating between pages is fast.
73. As a user, I want background refetching so that data stays up to date without manual refresh.
74. As a user, I want loading states to show skeletons or spinners, so that I know data is being fetched.
75. As a user, I want error states to show clear error messages, so that I know when something has failed.
76. As a user, I want memoized table rows (ChickenTableRow, HenRow) to remain memoized, so that performance is maintained with MUI's heavier components.

### Responsive Design

77. As a mobile user, I want all pages to be usable on a phone screen, so that I can use the app at the coop.
78. As a desktop user, I want all pages to use the full screen width effectively, so that I can see more data at once.
79. As a tablet user, I want layouts to adapt to the medium screen size, so that the app is usable on any device.

## Implementation Decisions

### Dependencies

- **MUI v6** (`@mui/material`, `@emotion/react`, `@emotion/styled`) — chosen over v5 for better MD3 token support. Community/Free tier, MIT licensed.
- **MUI Icons** (`@mui/icons-material`) — MIT licensed, comprehensive icon set matching MD3.
- **MUI Date Pickers** (`@mui/x-date-pickers`) — Community edition, MIT licensed. Used for all date inputs (Log Egg date, enrollment acquisition date, note dates, departure date, dashboard date range).
- **React Hook Form** + **Zod** + `@hookform/resolvers/zod` — form handling and schema-based validation for all forms (Log Egg, enrollment, note add/edit, photo upload, chicken edit, admin user/list management).
- **TanStack Query** (`@tanstack/react-query`) — data fetching with caching, background refetch, deduplication, and clean loading/error states. Replaces all `useEffect` + `fetch` + `useState` patterns.
- **TanStack Table** (`@tanstack/react-table`) — used with MUI Table for sortable/filterable tables (Roster, Dashboard metrics, Admin users).

### Theme Architecture

- **MD3 palette** generated programmatically from source color #AE9965 using the HCT color space algorithm. Both light and dark mode palettes are generated. The palette covers all MD3 color roles: primary, on-primary, primary-container, on-primary-container, secondary, tertiary, error, surface, background, and their variants.
- **Theme configuration** via MUI `createTheme()` with MD3 tokens: typography scale (Display, Headline, Title, Body, Label in L/M/S), shape scale (corner radii), and simplified drop-shadow elevation (not MD3 tinted surfaces).
- **ThemeModeProvider** — a React context that holds the current mode (system/light/dark). Reads initial value from `localStorage`, defaults to system. Exposes a `useThemeMode()` hook for components to access and toggle.
- **ThemeProvider** wraps the MUI `ThemeProvider`, generating the appropriate light or dark MUI theme based on the current mode from ThemeModeProvider.
- **CssBaseline** included to apply theme colors to the body and reset defaults.
- **Theme preference** stored in `localStorage` (per-device, not per-user). The 3-way toggle is in the AppBar.

### Provider Hierarchy (Root Layout)

```
SessionProvider
  ThemeModeProvider
    ThemeProvider (MUI)
      CssBaseline
        QueryClientProvider
          AppShell
            {children}
```

### Navigation

- **AppBar** at the top with: app title (Typography h6), health indicator icon, theme toggle button, user menu button.
- **Persistent mini-drawer** on the left (desktop): collapsed to ~80px rail showing icons only, expands to ~240px on hover showing icons + labels. Nav items: Dashboard, Roster, Log Egg, Admin (Admin-only). Active route highlighted.
- **On mobile**, the drawer becomes a modal drawer (hamburger menu).

### Health Indicator

- Replaces the persistent SystemStatusFooter.
- A small icon in the AppBar: green checkmark when healthy, red warning when unhealthy.
- Fetches the health endpoint periodically.
- On error, shows a MUI `Snackbar` with the error message.
- No persistent footer remains.

### Page Migration Order

1. **Log Egg** — mobile priority, most time-sensitive screen. Table → vertical card stack (Stack of Cards, one per hen, with photo thumbnail, name, weight TextField). Responsive Grid (stack on mobile, 2-column on tablet).
2. **Roster** — second most used. HTML table → MUI Table with @tanstack/react-table for sorting/filtering. Enrollment form with RHF + Zod + Autocomplete for dynamic lists.
3. **Dashboard** — complex but high visibility. Metrics → grid of MUI Cards. Date range selector with DatePicker. Text tables for metrics data.
4. **Chicken Profile** — largest page (1,188 lines). Photo gallery → MUI ImageList. Notes → MUI List. Edit forms → MUI Dialog or inline Card. All forms use RHF + Zod.
5. **Admin** — least used. Users table → MUI Table with sorting. Dynamic lists → MUI List. Tabbed sections with MUI Tabs. All forms use RHF + Zod.
6. **Error pages** — trivial. Centered Container with Typography and Button.

### Form Validation UX

- All forms use React Hook Form with Zod schemas.
- Validation triggers on blur (field-level).
- Errors displayed as inline helper text below each MUI TextField (using the `error` and `helperText` props).
- No form-level error summary.

### Data Fetching Pattern

- All `useEffect` + `fetch` + `useState` patterns replaced with TanStack Query.
- `useQuery` for reads (with automatic loading/error states).
- `useMutation` for writes (with cache invalidation on success).
- Loading states: MUI `Skeleton` or `CircularProgress`.
- Error states: MUI `Alert` components.

### Layout Components

- All inline flexbox layouts replaced with MUI layout components: `Box`, `Stack`, `Grid`, `Container`.
- Responsive design built from scratch using MUI breakpoints (xs, sm, md, lg, xl). No legacy breakpoints to preserve.

### Styling Approach

- All inline styles eliminated.
- Custom layouts use MUI's `sx` prop or `styled()` API.
- Theme tokens used for colors, spacing, typography, and shape.
- No CSS modules, no Tailwind, no global CSS beyond the box-sizing reset.

### Memoization

- `ChickenTableRow` and `HenRow` retain `React.memo` wrapping. MUI components are heavier than raw HTML, so memoization may be more important, not less.

### Component Tests

- Component tests (`tests/components/`) disabled during migration via `testPathIgnorePatterns` in `jest.config.ts`.
- After all migrations complete, tests are updated to query MUI components by role/text and re-enabled.
- Integration tests remain active throughout (no API changes, so they stay green).

## Testing Decisions

### What makes a good test

- Test external behavior (what the user sees/does), not implementation details (which MUI component is used, which class name is applied).
- Query by role, label text, or visible text — not by test IDs or CSS classes.
- Integration tests verify API contracts and data flow. Component tests verify UI structure and user interactions.

### What will be tested

- **Integration tests** (existing, stay green): API routes, data fetching, auth flows. No changes needed since the API layer is untouched.
- **Component tests** (existing, disabled then updated):
  - `AppShell.test.tsx` — verify AppBar, Drawer, nav items, theme toggle, user menu render correctly with MUI.
  - `NavMenu.test.tsx` — verify nav links render with correct icons and active state.
  - `UserMenu.test.tsx` — verify user menu opens, shows user info, sign out works.
  - `SystemStatusFooter.test.tsx` → renamed to `HealthIndicator.test.tsx` — verify health icon shows correct state, Snackbar appears on error.
  - `RosterPage.test.tsx` — verify MUI table renders, sorting works, enrollment form validates.

### Prior art

- Existing component tests use `@testing-library/react` with `jest-environment-jsdom` and `tsconfig.jest.json`.
- Existing integration tests use `jest.config.ts` with node environment and `dotenv` for test DB config.
- Both configs and setup files remain unchanged (except `testPathIgnorePatterns` during migration).

## Out of Scope

- **Charts and graphs.** The dashboard currently uses text tables for all metrics. Adding charting libraries (Recharts, Chart.js, etc.) is explicitly deferred to a future enhancement.
- **Bundle size optimization.** MUI adds ~100-150KB gzipped. For a 5-user LAN app, this is irrelevant.
- **Offline/PWA support.** The app is always-online over LAN. No offline capability is needed.
- **New features or functionality.** This is a pure UI migration. No new screens, no new data models, no new API endpoints.
- **Domain model changes.** The glossary in CONTEXT.md is unchanged. All domain concepts (Chicken, Egg, Note, Photo, Departure, Dynamic List, etc.) remain the same.
- **API changes.** All API routes remain unchanged. The migration only touches the client-side rendering layer.
- **MD3 tinted surface elevation.** Simplified drop-shadow elevation is used instead of the full MD3 surface tint approach.
- **Per-user theme preference in database.** Theme preference is per-device (localStorage), not per-user.

## Further Notes

### ADR

This migration warrants an ADR (`docs/adr/0006-mui-material-design-3.md`) because:
- **Hard to reverse:** Full adoption of MUI across all pages makes reverting a large effort.
- **Surprising without context:** A future reader might wonder why MUI over alternatives like Tailwind, Chakra, or shadcn/ui.
- **Real trade-off:** MUI was chosen for MD3 support, component richness, MIT license, and fit with the app's form-heavy, data-dense UI. Alternatives were considered and rejected.

### Migration risk

The incremental approach (shell-first, then page-by-page) means that during migration, the app will have a mix of MUI-styled and inline-styled pages. This is acceptable because:
- The shell (AppBar, drawer) frames every page, providing the MD3 feel immediately.
- Each page migration is self-contained and can be reviewed/merged independently.
- The visual inconsistency is temporary and resolves as pages are migrated.

### No new seams

The migration introduces no new testing seams. All testing happens through existing integration tests (which stay green) and existing component tests (which are disabled then updated). The only new code seams are the theme provider and the HealthIndicator component, both tested through the existing component test infrastructure.
