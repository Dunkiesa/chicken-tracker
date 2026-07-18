import { ensureDatabase, runMigrations, closePool, getPool, ensureMigrations } from "@/lib/db";
import { createChicken, listChickens, type Chicken } from "@/lib/chickens";
import { createNote, type Note } from "@/lib/notes";
import {
  createPendingNoteImage,
  attachPendingNoteImageToNote,
  updateNoteImageStatus,
  getNoteImage,
  listNoteImagesByNote,
  listPendingNoteImagesByChicken,
  discardNoteImage,
  deleteNoteImagesForNote,
  sweepOrphanNoteImages,
  NoteImageNotPendingError,
  type NoteImage,
} from "@/lib/note_images";
import {
  applyCrop,
  generateThumbnail,
  validateImageMagicBytes,
  readImageDimensions,
  resolveImagePath,
  getNotesImageDirectory,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/image-storage";
import sharp from "sharp";
import { writeFile, mkdir, rm, readFile, stat, unlink } from "fs/promises";
import { join, resolve } from "path";
import { randomUUID } from "crypto";

const TEST_IMAGE_DIR = resolve(process.cwd(), "images-test");
process.env.IMAGE_DIR = TEST_IMAGE_DIR;

const RECORDED_BY = "test-note-images@example.com";

async function ensureHen(name: string): Promise<Chicken> {
  const all = await listChickens();
  const existing = all.find((c: Chicken) => c.name === name);
  if (existing) return existing;
  return createChicken({ name, sex: "Hen" });
}

async function makeTestImage(
  width: number,
  height: number,
  filename: string
): Promise<string> {
  const buf = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 80, b: 200 },
    },
  })
    .png()
    .toBuffer();
  const relativePath = `notes/${filename}`;
  const fullPath = join(TEST_IMAGE_DIR, relativePath);
  await mkdir(join(TEST_IMAGE_DIR, "notes"), { recursive: true });
  await writeFile(fullPath, buf);
  return relativePath;
}

async function fileExists(relPath: string): Promise<boolean> {
  try {
    await stat(resolveImagePath(relPath));
    return true;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  await rm(TEST_IMAGE_DIR, { recursive: true, force: true });
  await mkdir(TEST_IMAGE_DIR, { recursive: true });
  await mkdir(getNotesImageDirectory(), { recursive: true });
  await mkdir(join(getNotesImageDirectory(), "_pending"), { recursive: true });
  await ensureDatabase();
  await ensureMigrations();
}, 30000);

beforeEach(async () => {
  const pool = await getPool();
  await pool.request().query("DELETE FROM note_images");
});

afterAll(async () => {
  await closePool();
  await rm(TEST_IMAGE_DIR, { recursive: true, force: true });
});

describe("Note images data layer", () => {
  it("creates a pending note image with status=pending and no note_id", async () => {
    const hen = await ensureHen("NoteImage CreatePending");
    const filename = await makeTestImage(200, 200, `pending_${randomUUID()}.png`);

    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: filename,
      original_width: 200,
      original_height: 200,
      recorded_by: RECORDED_BY,
    });

    expect(img.id).toBeGreaterThan(0);
    expect(img.chicken_id).toBe(hen.id);
    expect(img.note_id).toBeNull();
    expect(img.file_path).toBe(filename);
    expect(img.status).toBe("pending");
    expect(img.original_width).toBe(200);
    expect(img.original_height).toBe(200);
    expect(img.recorded_by).toBe(RECORDED_BY);
    expect(img.crop_x_min).toBeNull();
    expect(img.crop_x_max).toBeNull();
  }, 15000);

  it("attaches a pending image to a note, persists the crop region, and sets status=succeeded", async () => {
    const hen = await ensureHen("NoteImage Attach");
    const note: Note = await createNote({
      chicken_id: hen.id,
      content: "Vet receipt attached",
      date: "2026-07-10",
      recorded_by: RECORDED_BY,
    });
    const filename = await makeTestImage(400, 300, `attach_${randomUUID()}.png`);

    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: filename,
      original_width: 400,
      original_height: 300,
      recorded_by: RECORDED_BY,
    });

    const croppedFilename = `cropped_${randomUUID()}.png`;
    const attached = await attachPendingNoteImageToNote(img.id, note.id, {
      cropped_file_path: croppedFilename,
      crop_x_min: 0.1,
      crop_y_min: 0.2,
      crop_x_max: 0.9,
      crop_y_max: 0.8,
    });

    expect(attached).not.toBeNull();
    expect(attached!.note_id).toBe(note.id);
    expect(attached!.file_path).toBe(croppedFilename);
    expect(attached!.status).toBe("succeeded");
    expect(attached!.crop_x_min).toBeCloseTo(0.1);
    expect(attached!.crop_y_min).toBeCloseTo(0.2);
    expect(attached!.crop_x_max).toBeCloseTo(0.9);
    expect(attached!.crop_y_max).toBeCloseTo(0.8);

    expect(await fileExists(filename)).toBe(false);
  }, 15000);

  it("lists note images for a note in insertion order", async () => {
    const hen = await ensureHen("NoteImage ListByNote");
    const note = await createNote({
      chicken_id: hen.id,
      content: "Multi-image note",
      date: "2026-07-11",
      recorded_by: RECORDED_BY,
    });

    const a = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: await makeTestImage(100, 100, `a_${randomUUID()}.png`),
      original_width: 100,
      original_height: 100,
      recorded_by: RECORDED_BY,
    });
    const b = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: await makeTestImage(100, 100, `b_${randomUUID()}.png`),
      original_width: 100,
      original_height: 100,
      recorded_by: RECORDED_BY,
    });
    await attachPendingNoteImageToNote(a.id, note.id, {
      cropped_file_path: `cropped_a_${randomUUID()}.png`,
      crop_x_min: 0,
      crop_y_min: 0,
      crop_x_max: 1,
      crop_y_max: 1,
    });
    await attachPendingNoteImageToNote(b.id, note.id, {
      cropped_file_path: `cropped_b_${randomUUID()}.png`,
      crop_x_min: 0,
      crop_y_min: 0,
      crop_x_max: 1,
      crop_y_max: 1,
    });

    const list = await listNoteImagesByNote(note.id);
    expect(list.length).toBe(2);
    expect(list[0]!.id).toBe(a.id);
    expect(list[1]!.id).toBe(b.id);
  }, 15000);

  it("lists only pending (note_id IS NULL) images for a chicken", async () => {
    const henA = await ensureHen("NoteImage PendingList A");
    const henB = await ensureHen("NoteImage PendingList B");
    const note = await createNote({
      chicken_id: henA.id,
      content: "x",
      date: "2026-07-12",
      recorded_by: RECORDED_BY,
    });

    const pendingA = await createPendingNoteImage({
      chicken_id: henA.id,
      file_path: await makeTestImage(50, 50, `pa_${randomUUID()}.png`),
      original_width: 50,
      original_height: 50,
      recorded_by: RECORDED_BY,
    });
    await createPendingNoteImage({
      chicken_id: henB.id,
      file_path: await makeTestImage(50, 50, `pb_${randomUUID()}.png`),
      original_width: 50,
      original_height: 50,
      recorded_by: RECORDED_BY,
    });
    const attached = await createPendingNoteImage({
      chicken_id: henA.id,
      file_path: await makeTestImage(50, 50, `att_${randomUUID()}.png`),
      original_width: 50,
      original_height: 50,
      recorded_by: RECORDED_BY,
    });
    await attachPendingNoteImageToNote(attached.id, note.id, {
      cropped_file_path: `cropped_att_${randomUUID()}.png`,
      crop_x_min: 0,
      crop_y_min: 0,
      crop_x_max: 1,
      crop_y_max: 1,
    });

    const aPending = await listPendingNoteImagesByChicken(henA.id);
    expect(aPending.length).toBe(1);
    expect(aPending[0]!.id).toBe(pendingA.id);
    expect(aPending[0]!.note_id).toBeNull();

    const bPending = await listPendingNoteImagesByChicken(henB.id);
    expect(bPending.length).toBe(1);
  }, 15000);

  it("transitions status through pending → processing → succeeded with ai_suggestion", async () => {
    const hen = await ensureHen("NoteImage Status");
    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: await makeTestImage(80, 80, `status_${randomUUID()}.png`),
      original_width: 80,
      original_height: 80,
      recorded_by: RECORDED_BY,
    });
    expect(img.status).toBe("pending");

    const processing = await updateNoteImageStatus(img.id, "processing");
    expect(processing!.status).toBe("processing");
    expect(processing!.ai_suggestion).toBeNull();

    const succeeded = await updateNoteImageStatus(img.id, "succeeded", {
      ai_suggestion: "AI caption suggestion",
    });
    expect(succeeded!.status).toBe("succeeded");
    expect(succeeded!.ai_suggestion).toBe("AI caption suggestion");
  }, 15000);

  it("transitions to failed with ai_error set", async () => {
    const hen = await ensureHen("NoteImage Failed");
    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: await makeTestImage(80, 80, `failed_${randomUUID()}.png`),
      original_width: 80,
      original_height: 80,
      recorded_by: RECORDED_BY,
    });
    const failed = await updateNoteImageStatus(img.id, "failed", {
      ai_error: "Vision model timed out",
    });
    expect(failed!.status).toBe("failed");
    expect(failed!.ai_error).toBe("Vision model timed out");
  }, 15000);

  it("discardNoteImage removes the row and the file on disk", async () => {
    const hen = await ensureHen("NoteImage Discard");
    const filename = await makeTestImage(60, 60, `discard_${randomUUID()}.png`);
    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: filename,
      original_width: 60,
      original_height: 60,
      recorded_by: RECORDED_BY,
    });

    expect(await fileExists(filename)).toBe(true);

    const ok = await discardNoteImage(img.id);
    expect(ok).toBe(true);
    expect(await getNoteImage(img.id)).toBeNull();
    expect(await fileExists(filename)).toBe(false);
  }, 15000);

  it("deleteNoteImagesForNote removes the rows (and the files)", async () => {
    const hen = await ensureHen("NoteImage DeleteByNote");
    const note = await createNote({
      chicken_id: hen.id,
      content: "About to be cascade-deleted",
      date: "2026-07-13",
      recorded_by: RECORDED_BY,
    });
    const a = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: await makeTestImage(70, 70, `dna_${randomUUID()}.png`),
      original_width: 70,
      original_height: 70,
      recorded_by: RECORDED_BY,
    });
    const b = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: await makeTestImage(70, 70, `dnb_${randomUUID()}.png`),
      original_width: 70,
      original_height: 70,
      recorded_by: RECORDED_BY,
    });
    const croppedA = `cropped_dna_${randomUUID()}.png`;
    const croppedB = `cropped_dnb_${randomUUID()}.png`;
    await attachPendingNoteImageToNote(a.id, note.id, {
      cropped_file_path: croppedA,
      crop_x_min: 0,
      crop_y_min: 0,
      crop_x_max: 1,
      crop_y_max: 1,
    });
    await attachPendingNoteImageToNote(b.id, note.id, {
      cropped_file_path: croppedB,
      crop_x_min: 0,
      crop_y_min: 0,
      crop_x_max: 1,
      crop_y_max: 1,
    });

    const removed = await deleteNoteImagesForNote(note.id);
    expect(removed).toBe(2);

    const remaining = await listNoteImagesByNote(note.id);
    expect(remaining.length).toBe(0);

    expect(await fileExists(croppedA)).toBe(false);
    expect(await fileExists(croppedB)).toBe(false);
  }, 15000);

  it("cascade-deletes note_images rows when the parent note row is deleted (FK ON DELETE CASCADE)", async () => {
    const hen = await ensureHen("NoteImage FkCascade");
    const note = await createNote({
      chicken_id: hen.id,
      content: "Will be deleted at SQL level",
      date: "2026-07-14",
      recorded_by: RECORDED_BY,
    });
    const a = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: await makeTestImage(50, 50, `fka_${randomUUID()}.png`),
      original_width: 50,
      original_height: 50,
      recorded_by: RECORDED_BY,
    });
    await attachPendingNoteImageToNote(a.id, note.id, {
      cropped_file_path: `cropped_fka_${randomUUID()}.png`,
      crop_x_min: 0,
      crop_y_min: 0,
      crop_x_max: 1,
      crop_y_max: 1,
    });

    const pool = await getPool();
    await pool.request().input("id", require("mssql").Int, note.id)
      .query("DELETE FROM notes WHERE id = @id");

    const remaining = await listNoteImagesByNote(note.id);
    expect(remaining.length).toBe(0);
  }, 15000);

  it("sweepOrphanNoteImages only reaps rows where note_id IS NULL AND created_at < threshold", async () => {
    const hen = await ensureHen("NoteImage Sweep");
    const pool = await getPool();
    const old = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: await makeTestImage(40, 40, `old_${randomUUID()}.png`),
      original_width: 40,
      original_height: 40,
      recorded_by: RECORDED_BY,
    });
    const fresh = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: await makeTestImage(40, 40, `fresh_${randomUUID()}.png`),
      original_width: 40,
      original_height: 40,
      recorded_by: RECORDED_BY,
    });

    await pool
      .request()
      .input("id", require("mssql").Int, old.id)
      .input("past", require("mssql").DateTime2, new Date(Date.now() - 48 * 60 * 60 * 1000))
      .query("UPDATE note_images SET created_at = @past WHERE id = @id");

    const reaped = await sweepOrphanNoteImages(24);
    expect(reaped).toBe(1);

    expect(await getNoteImage(old.id)).toBeNull();
    expect(await getNoteImage(fresh.id)).not.toBeNull();

    expect(await fileExists(old.file_path)).toBe(false);
    expect(await fileExists(fresh.file_path)).toBe(true);
  }, 15000);

  it("attachPendingNoteImageToNote throws NoteImageNotPendingError on re-attach", async () => {
    const hen = await ensureHen("NoteImage Reattach");
    const note = await createNote({
      chicken_id: hen.id,
      content: "Re-attach attempt",
      date: "2026-07-15",
      recorded_by: RECORDED_BY,
    });
    const filename = await makeTestImage(30, 30, `reattach_${randomUUID()}.png`);

    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: filename,
      original_width: 30,
      original_height: 30,
      recorded_by: RECORDED_BY,
    });

    const first = await attachPendingNoteImageToNote(img.id, note.id, {
      cropped_file_path: `cropped_reattach_${randomUUID()}.png`,
      crop_x_min: 0,
      crop_y_min: 0,
      crop_x_max: 1,
      crop_y_max: 1,
    });
    expect(first!.note_id).toBe(note.id);

    await expect(
      attachPendingNoteImageToNote(img.id, note.id, {
        cropped_file_path: `cropped_reattach2_${randomUUID()}.png`,
        crop_x_min: 0,
        crop_y_min: 0,
        crop_x_max: 1,
        crop_y_max: 1,
      })
    ).rejects.toBeInstanceOf(NoteImageNotPendingError);

    await expect(
      attachPendingNoteImageToNote(img.id, note.id, {
        cropped_file_path: `cropped_reattach2_${randomUUID()}.png`,
        crop_x_min: 0,
        crop_y_min: 0,
        crop_x_max: 1,
        crop_y_max: 1,
      })
    ).rejects.toMatchObject({
      name: "NoteImageNotPendingError",
      code: "NOTE_IMAGE_NOT_PENDING",
      note_image_id: img.id,
    });

    const still = await getNoteImage(img.id);
    expect(still!.note_id).toBe(note.id);
  }, 15000);

  it("discardNoteImage leaves no orphan row when the file is already gone", async () => {
    const hen = await ensureHen("NoteImage Discard Gone");
    const filename = await makeTestImage(35, 35, `gone_${randomUUID()}.png`);
    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: filename,
      original_width: 35,
      original_height: 35,
      recorded_by: RECORDED_BY,
    });

    expect(await fileExists(filename)).toBe(true);
    await unlink(resolveImagePath(filename));
    expect(await fileExists(filename)).toBe(false);

    const ok = await discardNoteImage(img.id);
    expect(ok).toBe(true);
    expect(await getNoteImage(img.id)).toBeNull();
  }, 15000);

  it("deleteNoteImagesForNote tolerates a row whose file vanished before unlink", async () => {
    const hen = await ensureHen("NoteImage DeleteByNote Vanished");
    const note = await createNote({
      chicken_id: hen.id,
      content: "Some files missing",
      date: "2026-07-16",
      recorded_by: RECORDED_BY,
    });

    const a = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: await makeTestImage(45, 45, `vna_${randomUUID()}.png`),
      original_width: 45,
      original_height: 45,
      recorded_by: RECORDED_BY,
    });
    const b = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: await makeTestImage(45, 45, `vnb_${randomUUID()}.png`),
      original_width: 45,
      original_height: 45,
      recorded_by: RECORDED_BY,
    });
    const croppedA = `cropped_vna_${randomUUID()}.png`;
    const croppedB = `cropped_vnb_${randomUUID()}.png`;
    await writeFile(resolveImagePath(croppedA), Buffer.from("dummy-cropped-A"));
    await writeFile(resolveImagePath(croppedB), Buffer.from("dummy-cropped-B"));
    await attachPendingNoteImageToNote(a.id, note.id, {
      cropped_file_path: croppedA,
      crop_x_min: 0,
      crop_y_min: 0,
      crop_x_max: 1,
      crop_y_max: 1,
    });
    await attachPendingNoteImageToNote(b.id, note.id, {
      cropped_file_path: croppedB,
      crop_x_min: 0,
      crop_y_min: 0,
      crop_x_max: 1,
      crop_y_max: 1,
    });

    expect(await fileExists(croppedA)).toBe(true);
    expect(await fileExists(croppedB)).toBe(true);
    await unlink(resolveImagePath(croppedA));
    expect(await fileExists(croppedA)).toBe(false);

    const removed = await deleteNoteImagesForNote(note.id);
    expect(removed).toBe(2);

    const remaining = await listNoteImagesByNote(note.id);
    expect(remaining.length).toBe(0);

    expect(await fileExists(croppedB)).toBe(false);
  }, 15000);

  it("the orphan-sweep index is on (note_id, created_at) and the old (status, created_at) index is gone", async () => {
    const pool = await getPool();

    const getNoteImageIndexes = async (): Promise<Map<string, string[]>> => {
      const result = await pool.request().query(`
        SELECT i.name AS index_name, c.name AS column_name, ic.key_ordinal
        FROM sys.indexes i
        JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE i.object_id = OBJECT_ID('note_images')
          AND i.is_primary_key = 0
        ORDER BY i.name, ic.key_ordinal
      `);
      const byName = new Map<string, string[]>();
      for (const row of result.recordset) {
        const list = byName.get(row.index_name) ?? [];
        list.push(row.column_name);
        byName.set(row.index_name, list);
      }
      return byName;
    };

    const before = await getNoteImageIndexes();
    expect(before.get("IX_note_images_note_id_created_at")).toEqual([
      "note_id",
      "created_at",
    ]);
    expect(before.has("IX_note_images_status_created_at")).toBe(false);

    await runMigrations();
    await runMigrations();

    const after = await getNoteImageIndexes();
    expect(after.get("IX_note_images_note_id_created_at")).toEqual([
      "note_id",
      "created_at",
    ]);
    expect(after.has("IX_note_images_status_created_at")).toBe(false);
  }, 15000);
});

describe("Image storage helpers", () => {
  it("exports the photo allowlist and 10MB cap", () => {
    expect(ALLOWED_MIME_TYPES).toEqual(
      expect.arrayContaining([
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/bmp",
      ])
    );
    expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });

  it("validates magic bytes for known image formats and rejects garbage", async () => {
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(validateImageMagicBytes(pngHeader)).toBe(true);

    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x00]);
    expect(validateImageMagicBytes(jpegHeader)).toBe(true);

    const text = Buffer.from("hello world");
    expect(validateImageMagicBytes(text)).toBe(false);

    const tooShort = Buffer.from([0x89]);
    expect(validateImageMagicBytes(tooShort)).toBe(false);
  });

  it("readImageDimensions returns the original width and height", async () => {
    const filename = await makeTestImage(123, 87, `dim_${randomUUID()}.png`);
    const dims = await readImageDimensions(filename);
    expect(dims.width).toBe(123);
    expect(dims.height).toBe(87);
  });

  it("applyCrop crops the image using a normalized 0–1 region and writes the result", async () => {
    const filename = await makeTestImage(100, 100, `crop_${randomUUID()}.png`);
    const croppedName = `cropped_result_${randomUUID()}.png`;
    await applyCrop(
      filename,
      croppedName,
      { x_min: 0.25, y_min: 0.25, x_max: 0.75, y_max: 0.75 },
      { width: 100, height: 100 }
    );

    const out = await readImageDimensions(croppedName);
    expect(out.width).toBe(50);
    expect(out.height).toBe(50);
  });

  it("generateThumbnail writes a .webp of the configured dimensions", async () => {
    const filename = await makeTestImage(800, 600, `thumb_src_${randomUUID()}.png`);
    const thumbName = `thumb_${randomUUID()}.webp`;
    await generateThumbnail(filename, thumbName);
    const out = await readImageDimensions(thumbName);
    expect(out.width).toBe(300);
    expect(out.height).toBe(300);
    const bytes = await readFile(resolveImagePath(thumbName));
    const header = bytes.slice(0, 4).toString("hex");
    expect(header.startsWith("52494646")).toBe(true);
  });
});
