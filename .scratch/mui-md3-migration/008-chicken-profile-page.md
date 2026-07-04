**Triage label:** `ready-for-agent`

## What to build

Migrate the Chicken Profile page to MUI with full refactoring of data fetching, form handling, and layout. This is the largest page (1,188 lines) with chicken details, photos, notes, and edit functionality.

Replace all useEffect + fetch + useState data fetching with TanStack Query (useQuery for chicken details, notes, and photos; useMutation for adding/editing/deleting notes, uploading/deleting photos, setting primary photo, and editing chicken details, all with cache invalidation). Replace all manual useState validation with React Hook Form + Zod schema validation for all forms (add/edit note, upload photo, edit chicken) with validation triggering on blur and inline error messages.

Replace the chicken info section with a MUI Card showing photo, name, sex badge, breed, and status. Replace the photo gallery with MUI ImageList component (grid of photo thumbnails). Add click-to-view-full-size using MUI Dialog for lightbox. Each photo shows description, timestamp, recorded by, and action buttons (set primary, delete) for Admins.

Replace the notes section with MUI List of ListItem components (chronological). Each note shows date, content, recorded by, and edit/delete buttons for Admins. Edit forms use MUI Dialog or inline Card with form fields. Action buttons use MUI Button (edit, delete, upload).

Preserve sex badges (Hen=pink, Rooster=blue, Unknown=purple) and departure status styling using MUI Chip or Badge components with theme colors.

## Acceptance criteria

- [ ] Data fetching uses TanStack Query (useQuery for chicken, notes, photos; useMutation for all mutations)
- [ ] All forms (add/edit note, upload photo, edit chicken) use React Hook Form with Zod schema validation
- [ ] Validation triggers on blur with inline error messages below each field
- [ ] Chicken info displayed in MUI Card with photo, name, sex badge, breed, status
- [ ] Photo gallery uses MUI ImageList component (grid of thumbnails)
- [ ] Click photo opens full-size view in MUI Dialog (lightbox)
- [ ] Each photo shows description, timestamp, recorded by, and action buttons (Admin only)
- [ ] Notes displayed as MUI List of ListItem components (chronological)
- [ ] Each note shows date, content, recorded by, and edit/delete buttons (Admin only)
- [ ] Edit forms use MUI Dialog or inline Card with form fields
- [ ] Action buttons use MUI Button (edit, delete, upload)
- [ ] Sex badges preserved (Hen=pink, Rooster=blue, Unknown=purple) using MUI Chip or Badge
- [ ] Departure status clearly indicated with MUI styling
- [ ] Loading states show MUI CircularProgress or Skeleton
- [ ] Error states show MUI Alert components
- [ ] All inline styles replaced with MUI components and sx prop
- [ ] Page is fully functional and demoable

## Blocked by

- Issue 001 - Foundation & Theme Setup
- Issue 002 - AppShell & Navigation
