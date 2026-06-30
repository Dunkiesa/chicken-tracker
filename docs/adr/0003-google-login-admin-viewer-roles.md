# 3. Google login with Admin/Viewer roles

- Status: Accepted
- Date: 2026-06-30

## Context

The app has two kinds of users: someone who manages the flock (enrollment, profiles, dashboard) and someone who only logs eggs and views data. It runs on a personal server for a small, known set of people, so a self-managed password system would be unwarranted overhead and a security liability.

## Decision

Authenticate users via **Google login**, but restrict access with an app-managed **allowlist**: a `users` table mapping a verified email to a role (**Admin** or **Viewer**). Google login only authenticates (proves control of an email); authorization is the app's responsibility. On sign-in, the verified email is checked against the table — accounts not in it are denied even though Google authenticated them. The **first Admin is seeded from configuration** to avoid a lockout, and Admins manage the allowlist thereafter via an Admin UI. Write operations (enrolling and editing chickens, managing profiles, managing the allowlist) are gated to Admins; Viewers can sign in, read data, and log eggs. Sessions are **long-lived** and validated locally against the allowlist over the LAN, so routine use never re-contacts Google; only initial sign-in/re-login needs internet (see ADR 0005). The user base is small and trusted, making long-lived tokens an acceptable risk.

## Consequences

- No password storage or reset flows to build or secure; identity is delegated to Google.
- Not just anyone with a Google account can use the system — access is explicitly granted per email.
- Authorization is a simple two-role model plus an allowlist, enforced server-side on the API.
- Requires Google OAuth client configuration, a `users` table, and a seeded-admin config value for bootstrap.
- The seed admin must remain valid; if its email changes, the config must be updated or the allowlist could become unmanageable.
- Users without a Google account cannot be onboarded — acceptable for this flock.

## Alternatives considered

- **Local username/password** — full control, but the burden of secure credential storage and account recovery for no real benefit at this scale.
- **Finer-grained roles/permissions** — unnecessary; two roles cover the described needs.
