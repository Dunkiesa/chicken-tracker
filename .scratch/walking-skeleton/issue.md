# Walking Skeleton

## What to build

The thinnest possible end-to-end path through every layer, with no domain logic yet. `docker-compose` brings up SQL Server Express, the API, and a single responsive Next.js web app. The API exposes a `/health` endpoint that round-trips to the database (e.g. a trivial connectivity query) rather than returning a hardcoded value. The web app renders the health status it gets from the API.

This is the tracer bullet: it proves the database, the API, and the one responsive web app are wired together and deployable before any feature work begins. Per the PRD, the desktop and mobile experiences are a single responsive Next.js app sharing one API.

## Acceptance criteria

- [ ] `docker-compose up` starts SQL Server Express, the API, and the web app
- [ ] `GET /health` confirms live database connectivity (not a static response)
- [ ] The web app fetches and displays the health status
- [ ] An automated test covers the health endpoint's DB round-trip

## Blocked by

None - can start immediately

Triage: ready-for-agent
