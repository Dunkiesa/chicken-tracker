**Triage label:** `ready-for-agent`

## What to build

Migrate the Roster page to MUI with full refactoring of data fetching, form handling, and table display.

Replace all useEffect + fetch + useState data fetching with TanStack Query (useQuery for fetching chickens list, useMutation for enrolling/editing chickens with cache invalidation). Replace manual useState validation with React Hook Form + Zod schema validation for the enrollment form (name, sex, breed, origin source, acquisition type, acquisition date) with validation triggering on blur and inline error messages.

Replace the HTML table with MUI Table components (TableHead, TableBody, TableRow, TableCell) integrated with @tanstack/react-table for sorting and filtering. Use the migrated ChickenTableRow component from issue 004. Each row shows primary photo thumbnail, name, sex badge, and breed. Add click-to-navigate to chicken profile and action buttons (view profile, edit for Admins).

The enrollment form uses MUI TextField, Select, DatePicker, and Button. Use MUI Autocomplete for dynamic list pickers (breed, origin source, acquisition type) so users can pick from existing values or add new ones. Add a search TextField with search icon for filtering. Show empty state with MUI Typography when no chickens exist. Add "show departed" toggle to include/exclude departed birds.

## Acceptance criteria

- [ ] Data fetching uses TanStack Query (useQuery for chickens, useMutation for enrollment)
- [ ] Enrollment form uses React Hook Form with Zod schema validation
- [ ] Validation triggers on blur with inline error messages below each field
- [ ] Chickens displayed in MUI Table with TableHead, TableBody, TableRow, TableCell
- [ ] Table uses @tanstack/react-table for sorting (click column headers) and filtering
- [ ] Uses migrated ChickenTableRow component from issue 004
- [ ] Each row shows primary photo thumbnail, name, sex badge, and breed
- [ ] Clicking a row navigates to chicken profile
- [ ] Action buttons (view profile, edit) present for Admin users
- [ ] Enrollment form uses MUI TextField, Select, DatePicker, Button
- [ ] Dynamic list pickers use MUI Autocomplete for breed, origin source, acquisition type
- [ ] Search TextField with search icon for filtering chickens
- [ ] Empty state shows MUI Typography with helpful message
- [ ] "Show departed" toggle to include/exclude departed birds
- [ ] All inline styles replaced with MUI components and sx prop
- [ ] Page is fully functional and demoable

## Blocked by

- Issue 001 - Foundation & Theme Setup
- Issue 002 - AppShell & Navigation
- Issue 004 - ChickenTableRow Component
