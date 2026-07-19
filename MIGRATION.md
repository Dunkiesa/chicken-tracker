# Database & Storage Migrations

## Tooling Setup

Build the tooling image:
```bash
docker build -f Dockerfile.tooling -t chickentrack-tooling .
```

Run migrations (replace `chickentrack_images` with your actual volume name):
```bash
docker run --rm --env-file .env -v chickentrack_images:/app/images chickentrack-tooling -c "npm run <migration-script>"
```

For interactive shell:
```bash
docker run --rm -it --env-file .env -v chickentrack_images:/app/images chickentrack-tooling
```

## Migrations

### Sharded Image Storage (2026-07-19)

**Script:** `npm run migrate:shard-images`

**What it does:**
- Moves existing photos from `{shard}/{filename}` into `photos/{shard}/{filename}`
- Moves existing note images into `notes/{shard}/{filename}`
- Updates `file_path` and `thumbnail_path` in `photos` and `note_images` tables
- Skips pending note images (transient, auto-cleaned within 24h)
- Idempotent - safe to run multiple times

**Final directory structure:**
```
images/
  photos/
    {shard}/{filename}
  notes/
    {shard}/{filename}
```

**Preview (dry run):**
```bash
docker run --rm --env-file .env -v chickentrack_images:/app/images chickentrack-tooling -c "npm run migrate:shard-images:dry"
```

**Run migration:**
```bash
docker run --rm --env-file .env -v chickentrack_images:/app/images chickentrack-tooling -c "npm run migrate:shard-images"
```

**Deployment order:**
1. Deploy new code first (reads work with both old and new paths)
2. Run migration script at your convenience
