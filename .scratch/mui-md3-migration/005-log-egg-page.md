**Triage label:** `ready-for-agent`

## What to build

Migrate the Log Egg page to MUI with full refactoring of data fetching and form handling. This is the mobile-priority page used at the coop for quick egg entry.

Replace all useEffect + fetch + useState data fetching with TanStack Query (useQuery for fetching hens list, useMutation for submitting eggs with cache invalidation). Replace manual useState validation with React Hook Form + Zod schema validation (weight: number, 20-200g range, date: valid date) with validation triggering on blur and inline error messages using MUI TextField error and helperText props.

Replace the current table-based hen grid with a vertical Stack of Card components (mobile-friendly). Each card shows the hen's primary photo thumbnail, name, and a weight TextField. Use MUI Grid for responsive layout (cards stack on mobile, 2-column on tablet). Use the migrated HenRow component from issue 003.

Add a MUI DatePicker from @mui/x-date-pickers for the date input at the top. Use MUI Button for submit, MUI Alert for error messages, and MUI CircularProgress or Skeleton for loading states. Roosters should be hidden by default with a "show all" toggle, and Departed birds hidden by default.

## Acceptance criteria

- [ ] Data fetching uses TanStack Query (useQuery for hens, useMutation for eggs)
- [ ] Form uses React Hook Form with Zod schema validation
- [ ] Validation triggers on blur with inline error messages below each field
- [ ] Date input uses MUI DatePicker from @mui/x-date-pickers
- [ ] Hen grid displays as vertical Stack of Card components (not table)
- [ ] Each card shows hen's primary photo thumbnail, name, and weight TextField
- [ ] Responsive Grid layout (stack on mobile, 2-column on tablet)
- [ ] Uses migrated HenRow component from issue 003
- [ ] Submit button uses MUI Button variant="contained"
- [ ] Error messages display as MUI Alert components
- [ ] Loading states show MUI CircularProgress or Skeleton
- [ ] Roosters hidden by default with "show all" toggle
- [ ] Departed birds hidden by default
- [ ] All inline styles replaced with MUI components and sx prop
- [ ] Page is fully functional and demoable

## Blocked by

- Issue 001 - Foundation & Theme Setup
- Issue 002 - AppShell & Navigation
- Issue 003 - HenRow Component
