# Google Login + Allowlist + Admin/Viewer Roles

## What to build

Cross-cutting authentication **and authorization**. Google login only authenticates — it proves a person controls a verified email. It does **not** decide who may use the system; by default any Google account could sign in. Access is restricted by an app-managed **allowlist**.

Maintain a `users` table mapping a verified email to a role (Admin or Viewer). On sign-in, check the authenticated user's verified email against this table:

- **Not in the table** → denied with a clear "not authorized for this app" message, even though Google authenticated them successfully.
- **In the table** → allowed in, with their assigned role.

Write operations (such as creating a chicken) are gated to Admins; Viewers can sign in, read data, and log eggs but cannot mutate chickens or manage users.

To avoid a chicken-and-egg lockout, the **first Admin is seeded from configuration** (an env/config value) so there is always at least one account that can manage the allowlist. Thereafter, Admins manage the allowlist through an **Admin UI**: add an email, assign its role, and remove an entry.

This slice goes end-to-end: the UI sign-in flow, the API verifying the Google identity and enforcing the allowlist, the API enforcing role-based authorization on endpoints, and the Admin UI for managing allowed users.

## Acceptance criteria

- [ ] A user can sign in with Google through the web app
- [ ] An authenticated user whose verified email is not in the `users` table is denied access with a clear message (authenticated, but not authorized)
- [ ] An authenticated user in the `users` table is admitted with their assigned Admin or Viewer role
- [ ] The first Admin is seeded from configuration on startup so the allowlist is never empty (no lockout)
- [ ] Admins can add an email and assign a role, and remove an entry, via an Admin UI
- [ ] Managing the allowlist is restricted to Admins; Viewers cannot access it
- [ ] Creating a chicken is restricted to Admins; Viewers receive an authorization error
- [ ] Viewers can sign in and read the chicken list
- [ ] Automated tests cover: allowlisted-admitted, non-allowlisted-denied, seed-bootstrap, and Admin-allowed vs Viewer-denied write paths

## Blocked by

- `.scratch/chicken-enrollment-minimal/issue.md`

Triage: ready-for-agent
