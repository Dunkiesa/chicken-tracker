**Triage label:** `ready-for-agent`

## What to build

Migrate the Dashboard page to MUI with full refactoring of data fetching and layout.

Replace all useEffect + fetch + useState data fetching with TanStack Query (useQuery for fetching analytics data with date range as a parameter). Replace the inline-styled metrics with a responsive grid of MUI Card components with CardContent. Each metric (production over time, average weight, egg weight variance, most productive chicken, production consistency, dry period alerts, seasonal trends, attrition breakdown) gets its own Card.

Add a date range selector using MUI DatePicker components (start/end dates) or a custom Select for preset ranges (last 7 days, last 30 days, last 12 months, custom). Use MD3 type scale (Headline, Title, Body) for all typography. Use MUI Grid for responsive card layout.

Production over time currently displays as a text table — keep this approach (charts are out of scope). All metrics should respect the date range selector. Departed birds' history should count within their active periods.

## Acceptance criteria

- [ ] Data fetching uses TanStack Query (useQuery for analytics data)
- [ ] Date range selector implemented with MUI DatePicker or custom Select for preset ranges
- [ ] Metrics displayed as responsive grid of MUI Card components with CardContent
- [ ] Each metric (production over time, average weight, egg weight variance, most productive chicken, production consistency, dry period alerts, seasonal trends, attrition breakdown) has its own Card
- [ ] MD3 type scale (Headline, Title, Body) used for all typography
- [ ] MUI Grid used for responsive card layout
- [ ] Production over time displays as text table (no charts)
- [ ] All metrics respect the date range selector
- [ ] Departed birds' history counts within their active periods
- [ ] Loading states show MUI CircularProgress or Skeleton
- [ ] Error states show MUI Alert components
- [ ] All inline styles replaced with MUI components and sx prop
- [ ] Page is fully functional and demoable

## Blocked by

- Issue 001 - Foundation & Theme Setup
- Issue 002 - AppShell & Navigation
