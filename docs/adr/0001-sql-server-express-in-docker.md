# 1. SQL Server Express in Docker

- Status: Accepted
- Date: 2026-06-30

## Context

ChickenTrack needs a relational store for chickens, eggs, dynamic lists, notes, and photo paths, running on a personal Ubuntu server. The data is relational and modest in volume (a single backyard flock). The whole system is deployed via Docker on that server.

## Decision

Use **SQL Server Express** running in a Docker container as the database.

## Consequences

- Free edition with capacity far beyond a single-flock workload.
- Runs cleanly as a container alongside the API in `docker-compose`, matching the deployment model.
- Ties the project to T-SQL and the SQL Server client tooling; queries and migrations assume SQL Server semantics.
- Express has size/compute ceilings, which are irrelevant at this scale but would need revisiting if scope ever grew beyond one flock (explicitly out of scope).

## Alternatives considered

- **PostgreSQL** — strong fit and fully open, but no specific advantage here over the chosen stack and not the operator's preference.
- **SQLite** — simplest to run, but a poorer fit for the containerized client/server deployment and concurrent web access.
