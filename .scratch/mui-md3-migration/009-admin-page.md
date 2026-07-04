**Triage label:** `ready-for-agent`

## What to build

Migrate the Admin page to MUI with full refactoring of data fetching, form handling, and layout.

Replace all useEffect + fetch + useState data fetching with TanStack Query (useQuery for users list and dynamic lists; useMutation for user management and dynamic list management, all with cache invalidation). Replace all manual useState validation with React Hook Form + Zod schema validation for all forms (add/edit user, add/edit dynamic list values) with validation triggering on blur and inline error messages.

Replace the users table with MUI Table components integrated with @tanstack/react-table for sorting. Each row shows email, role, and action buttons (change role, remove user). Replace dynamic lists (breeds, origin sources, acquisition types) with MUI List components with edit/delete buttons for each value. Organize different admin sections (user management, breeds, origin sources, acquisition types) with MUI Tabs.

Forms use MUI TextField, Select, Button, and Dialog. Add confirmation dialogs for destructive actions (remove user, delete list value).

## Acceptance criteria

- [ ] Data fetching uses TanStack Query (useQuery for users and dynamic lists; useMutation for all mutations)
- [ ] All forms (add/edit user, add/edit dynamic list values) use React Hook Form with Zod schema validation
- [ ] Validation triggers on blur with inline error messages below each field
- [ ] Users displayed in MUI Table with sorting via @tanstack/react-table
- [ ] Each user row shows email, role, and action buttons (change role, remove)
- [ ] Dynamic lists (breeds, origin sources, acquisition types) displayed as MUI List with edit/delete buttons
- [ ] Admin sections organized with MUI Tabs (user management, breeds, origin sources, acquisition types)
- [ ] Forms use MUI TextField, Select, Button, Dialog
- [ ] Confirmation dialogs for destructive actions (remove user, delete list value)
- [ ] Loading states show MUI CircularProgress or Skeleton
- [ ] Error states show MUI Alert components
- [ ] All inline styles replaced with MUI components and sx prop
- [ ] Page is fully functional and demoable

## Blocked by

- Issue 001 - Foundation & Theme Setup
- Issue 002 - AppShell & Navigation
