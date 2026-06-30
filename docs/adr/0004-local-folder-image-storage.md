# 4. Local-folder image storage with paths in the database

- Status: Accepted
- Date: 2026-06-30

## Context

Chicken profiles include photos with descriptions, shown as a chronological gallery. The system runs on a personal Ubuntu server via Docker. Images need to be stored somewhere durable and served back to the app, with their metadata (description, timestamp) queryable.

## Decision

Store image **files in a local folder on the server**, and persist only the **file path** plus metadata (description, timestamp, owning chicken) in the database.

## Consequences

- Keeps the database small and fast; binary data stays on the filesystem.
- The image folder must be a Docker volume so photos survive container restarts and rebuilds, and must be included in any backup strategy.
- The API is responsible for writing files to the folder and for serving them; orphaned files (path-in-DB without file, or vice versa) are a failure mode to guard against.
- Portability to a different host means moving the folder alongside the database.

## Alternatives considered

- **Storing images as blobs in the database** — keeps everything in one place and backed up together, but bloats the DB and degrades query/backup performance.
- **External object storage (e.g. S3-compatible)** — scalable and durable, but unnecessary infrastructure and cost for a single-server, single-flock deployment.
