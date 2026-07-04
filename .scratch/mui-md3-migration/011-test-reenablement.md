**Triage label:** `ready-for-agent`

## What to build

Re-enable and update all component tests after the MUI migration is complete. Update each test file to query MUI components by role, label text, or visible text instead of implementation details. Rename SystemStatusFooter.test.tsx to HealthIndicator.test.tsx since the component was replaced. Re-enable component tests in Jest config by removing the testPathIgnorePatterns entry that was added in issue 001. Run the full test suite to ensure all tests pass.

## Acceptance criteria

- [ ] AppShell.test.tsx updated to query MUI components by role/text
- [ ] NavMenu.test.tsx updated to query MUI components by role/text
- [ ] UserMenu.test.tsx updated to query MUI components by role/text
- [ ] SystemStatusFooter.test.tsx renamed to HealthIndicator.test.tsx and updated
- [ ] RosterPage.test.tsx updated to query MUI components by role/text
- [ ] Component tests re-enabled in Jest config (testPathIgnorePatterns entry removed)
- [ ] Full test suite passes (npm run test:all)
- [ ] All integration tests still pass (no API changes)
- [ ] All component tests pass with MUI components

## Blocked by

- Issue 005 - Log Egg Page
- Issue 006 - Roster Page
- Issue 007 - Dashboard Page
- Issue 008 - Chicken Profile Page
- Issue 009 - Admin Page
- Issue 010 - Error Pages
