import { config as dotenvConfig } from "dotenv";
import { resolve, join, dirname, basename } from "path";
import { rename, mkdir, copyFile, unlink, access } from "fs/promises";
import { constants } from "fs";

dotenvConfig({ path: resolve(__dirname, "..", ".env") });

import { getPool, closePool } from "../src/lib/db";
import { getImageDirectory } from "../src/lib/photos";
import { shardFilename, resolveImagePath } from "../src/lib/image-storage";

const SHARD_RE = /^[a-f0-9]{2}$/;

function needsSharding(filePath: string): boolean {
  if (!filePath) return false;
  const parts = filePath.split("/");
  if (parts.length === 1) return true;
  if (filePath.startsWith("notes/_pending/")) return false;
  if (parts.length === 3 && parts[0] === "notes" && SHARD_RE.test(parts[1]!)) return false;
  return true;
}

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await access(absPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function moveFile(src: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  try {
    await rename(src, dest);
  } catch {
    await copyFile(src, dest);
    await unlink(src);
  }
}

async function migratePhotos(imageDir: string): Promise<{ moved: number; skipped: number }> {
  const pool = await getPool();
  const { recordset } = await pool.request().query(
    `SELECT id, file_path, thumbnail_path FROM photos`
  );

  let moved = 0;
  let skipped = 0;

  for (const row of recordset) {
    const { id, file_path, thumbnail_path } = row as {
      id: number;
      file_path: string;
      thumbnail_path: string | null;
    };

    const updates: string[] = [];

    if (needsSharding(file_path)) {
      const fname = basename(file_path);
      const newPath = shardFilename(fname);
      const oldAbs = resolve(join(imageDir, file_path));
      const newAbs = resolveImagePath(newPath);

      if (await fileExists(oldAbs)) {
        await moveFile(oldAbs, newAbs);
      }
      updates.push(`file_path = N'${newPath.replace(/'/g, "''")}'`);
    }

    if (thumbnail_path && needsSharding(thumbnail_path)) {
      const fname = basename(thumbnail_path);
      const newPath = shardFilename(fname);
      const oldAbs = resolve(join(imageDir, thumbnail_path));
      const newAbs = resolveImagePath(newPath);

      if (await fileExists(oldAbs)) {
        await moveFile(oldAbs, newAbs);
      }
      updates.push(`thumbnail_path = N'${newPath.replace(/'/g, "''")}'`);
    }

    if (updates.length > 0) {
      await pool
        .request()
        .input("id", id)
        .query(`UPDATE photos SET ${updates.join(", ")} WHERE id = @id`);
      moved++;
    } else {
      skipped++;
    }
  }

  return { moved, skipped };
}

async function migrateNoteImages(imageDir: string): Promise<{ moved: number; skipped: number }> {
  const pool = await getPool();
  const { recordset } = await pool.request().query(
    `SELECT id, file_path, thumbnail_path FROM note_images`
  );

  let moved = 0;
  let skipped = 0;

  for (const row of recordset) {
    const { id, file_path, thumbnail_path } = row as {
      id: number;
      file_path: string;
      thumbnail_path: string | null;
    };

    const updates: string[] = [];

    if (needsSharding(file_path)) {
      const fname = basename(file_path);
      const newPath = `notes/${shardFilename(fname)}`;
      const oldAbs = resolve(join(imageDir, file_path));
      const newAbs = resolveImagePath(newPath);

      if (await fileExists(oldAbs)) {
        await moveFile(oldAbs, newAbs);
      }
      updates.push(`file_path = N'${newPath.replace(/'/g, "''")}'`);
    }

    if (thumbnail_path && needsSharding(thumbnail_path)) {
      const fname = basename(thumbnail_path);
      const newPath = `notes/${shardFilename(fname)}`;
      const oldAbs = resolve(join(imageDir, thumbnail_path));
      const newAbs = resolveImagePath(newPath);

      if (await fileExists(oldAbs)) {
        await moveFile(oldAbs, newAbs);
      }
      updates.push(`thumbnail_path = N'${newPath.replace(/'/g, "''")}'`);
    }

    if (updates.length > 0) {
      await pool
        .request()
        .input("id", id)
        .query(`UPDATE note_images SET ${updates.join(", ")} WHERE id = @id`);
      moved++;
    } else {
      skipped++;
    }
  }

  return { moved, skipped };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const imageDir = resolve(getImageDirectory());

  console.log(`Image directory: ${imageDir}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log("");

  if (dryRun) {
    const pool = await getPool();
    const photos = await pool.request().query(`SELECT id, file_path, thumbnail_path FROM photos`);
    const noteImgs = await pool.request().query(`SELECT id, file_path, thumbnail_path FROM note_images`);

    let photoCount = 0;
    for (const row of photos.recordset) {
      const r = row as { file_path: string; thumbnail_path: string | null };
      if (needsSharding(r.file_path)) photoCount++;
      if (r.thumbnail_path && needsSharding(r.thumbnail_path)) photoCount++;
    }

    let noteCount = 0;
    for (const row of noteImgs.recordset) {
      const r = row as { file_path: string; thumbnail_path: string | null };
      if (needsSharding(r.file_path)) noteCount++;
      if (r.thumbnail_path && needsSharding(r.thumbnail_path)) noteCount++;
    }

    console.log(`Photos to migrate: ${photoCount} path(s) across ${photos.recordset.length} row(s)`);
    console.log(`Note images to migrate: ${noteCount} path(s) across ${noteImgs.recordset.length} row(s)`);

    await closePool();
    return;
  }

  console.log("Migrating photos...");
  const photoResult = await migratePhotos(imageDir);
  console.log(`  Moved: ${photoResult.moved}, Already migrated: ${photoResult.skipped}`);

  console.log("Migrating note images...");
  const noteResult = await migrateNoteImages(imageDir);
  console.log(`  Moved: ${noteResult.moved}, Already migrated: ${noteResult.skipped}`);

  console.log("\nDone.");
  await closePool();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  closePool().finally(() => process.exit(1));
});
