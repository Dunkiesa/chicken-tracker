**Triage label:** `ready-for-agent`

## What to build

Migrate the error pages (unauthorized and auth error) to MUI. These are simple pages that display error messages and provide navigation back to the home page.

Replace inline styles with MUI Container for centered layout, MUI Typography for error messages, and MUI Button for navigation. The unauthorized page should clearly explain that the user doesn't have access. The auth error page should explain what went wrong with authentication.

## Acceptance criteria

- [ ] Unauthorized page uses MUI Container for centered layout
- [ ] Unauthorized page uses MUI Typography for error message explaining lack of access
- [ ] Unauthorized page has MUI Button to navigate home
- [ ] Auth error page uses MUI Container for centered layout
- [ ] Auth error page uses MUI Typography for error message explaining authentication issue
- [ ] Auth error page has MUI Button to navigate home
- [ ] All inline styles replaced with MUI components and sx prop
- [ ] Pages are fully functional and demoable

## Blocked by

- Issue 001 - Foundation & Theme Setup
- Issue 002 - AppShell & Navigation
