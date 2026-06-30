# 2. One responsive Next.js app

- Status: Accepted
- Date: 2026-06-30

## Context

The PRD describes two experiences: a **mobile web app** for quick egg entry in the coop, and a **desktop tool** for chicken enrollment and analysis. These could be built as two separate frontends sharing the API, or as one responsive app with role- and viewport-appropriate views.

## Decision

Build **one responsive Next.js app** that serves both experiences from a single codebase. The mobile experience centers on egg logging and Quick Log; the desktop experience centers on enrollment, profiles, and the dashboard.

## Consequences

- One frontend codebase, one build, one deployment — simpler skeleton and less duplication of API clients, auth, and shared components.
- Vertical slices touch a single frontend, so issues do not have to specify which app they target.
- Responsive layout and view selection must be handled within the one app; care is needed to keep the in-coop mobile flow fast and uncluttered despite sharing code with the heavier desktop views.

## Alternatives considered

- **Two separate frontends** (distinct mobile and desktop apps over a shared API) — clearer separation of the two experiences, but more setup, duplicated cross-cutting concerns, and more coordination across slices. Rejected for a single-flock, single-team project.
