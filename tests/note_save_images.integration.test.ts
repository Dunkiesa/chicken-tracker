jest.mock("next-auth", () => ({
  __esModule: true,
  getServerSession: jest.fn(),
}));

import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import {
  ensureDatabase,
  closePool,
  getPool,
  ensureMigrations,
} from "@/lib/db";
import { createChicken, listChickens, deleteChicken, type Chicken } from "@/lib/chickens";
import { createNote, getNote, type Note } from "@/lib/notes";
import { addUser, getUserByEmail } from "@/lib/users";
import {
  createPendingNoteImage,
  attachPendingNoteImageToNote,
  getNoteImage,
  listNoteImagesByNote,
  listPendingNoteImagesByChicken,
  type NoteImage,
} from "@/lib/note_images";
import {
  getNotesImageDirectory,
  getPendingImageDirectory,
  resolveImagePath,
  readImageDimensions,
} from "@/lib/image-storage";
import { POST as createNoteRoute } from "@/app/api/chickens/[id]/notes/route";
import {
  PUT as updateNoteRoute,
  DELETE as deleteNoteRoute,
} from "@/app/api/chickens/[id]/notes/[noteId]/route";
import { DELETE as deleteChickenRoute } from "@/app/api/chickens/[id]/route";
import sharp from "sharp";
import { writeFile, mkdir, rm, stat } from "fs/promises";
import { join, resolve } from "path";
import { randomUUID } from "crypto";

const TEST_IMAGE_DIR = resolve(process.cwd(), "images-test-note-save");
process.env.IMAGE_DIR = TEST_IMAGE_DIR;

const ADMIN_EMAIL = "test-note-save-admin@example.com";
const VIEWER_EMAIL = "test-note-save-viewer@example.com";
const OTHER_EMAIL = "test-note-save-other@example.com";

type SessionUser = { email: string; role: "Admin" | "Viewer" };
const mockedGetServerSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;

function setSession(user: SessionUser | null): void {
  if (user === null) {
    mockedGetServerSession.mockResolvedValue(null);
    return;
  }
  mockedGetServerSession.mockResolvedValue({
    user,
    expires: "2099-01-01T00:00:00.000Z",
  } as never);
}

async function ensureHen(name: string): Promise<Chicken> {
  const all = await listChickens();
  const existing = all.find((c) => c.name === name);
  if (existing) return existing;
  return createChicken({ name, sex: "Hen" });
}

async function ensureUser(email: string, role: "Admin" | "Viewer"): Promise<void> {
  const existing = await getUserByEmail(email);
  if (existing) return;
  await addUser(email, role);
}

async function makePngBuffer(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 90, g: 130, b: 210 },
    },
  })
    .png()
    .toBuffer();
}

function buildJsonRequest(
  url: string,
  body: unknown,
  method: string = "POST"
): NextRequest {
  return new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await stat(absPath);
    return true;
  } catch {
    return false;
  }
}

async function createPendingImageWithFiles(
  chickenId: number,
  recordedBy: string,
  width = 100,
  height = 100
): Promise<NoteImage> {
  const buf = await makePngBuffer(width, height);
  const filename = `test_${randomUUID()}.png`;
  const pendingDir = getPendingImageDirectory();
  const absFile = join(pendingDir, filename);
  await writeFile(absFile, buf);

  const baseName = filename.replace(/\.[^.]+$/, "");
  const thumbFilename = `${baseName}_thumb.webp`;
  const absThumb = join(pendingDir, thumbFilename);
  const thumbBuf = await sharp(buf)
    .resize(300, 300, { fit: "cover" })
    .webp({ quality: 85 })
    .toBuffer();
  await writeFile(absThumb, thumbBuf);

  return createPendingNoteImage({
    chicken_id: chickenId,
    file_path: `notes/_pending/${filename}`,
    original_width: width,
    original_height: height,
    recorded_by: recordedBy,
  });
}

beforeAll(async () => {
  await rm(TEST_IMAGE_DIR, { recursive: true, force: true });
  await mkdir(TEST_IMAGE_DIR, { recursive: true });
  await mkdir(getNotesImageDirectory(), { recursive: true });
  await mkdir(getPendingImageDirectory(), { recursive: true });
  await ensureDatabase();
  await ensureMigrations();
  await ensureUser(ADMIN_EMAIL, "Admin");
  await ensureUser(VIEWER_EMAIL, "Viewer");
  await ensureUser(OTHER_EMAIL, "Viewer");
}, 30000);

beforeEach(async () => {
  const pool = await getPool();
  await pool.request().query("DELETE FROM note_images");
  setSession(null);
});

afterAll(async () => {
  await closePool();
  await rm(TEST_IMAGE_DIR, { recursive: true, force: true });
});

describe("POST /api/chickens/[id]/notes — note save with images", () => {
  it("creates a note with one image: persisted file is cropped, transient is gone, row is succeeded", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("NoteSave OneImage");
    const img = await createPendingImageWithFiles(hen.id, ADMIN_EMAIL, 200, 200);
    const transientPath = resolveImagePath(img.file_path);
    expect(await fileExists(transientPath)).toBe(true);

    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes`,
      {
        content: "Note with image",
        date: "2026-07-18",
        imageIds: [img.id],
        crops: {
          [String(img.id)]: { x_min: 0.25, y_min: 0.25, x_max: 0.75, y_max: 0.75 },
        },
      }
    );
    const response = await createNoteRoute(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(201);
    const note = (await response.json()) as Note;
    expect(note.content).toBe("Note with image");

    const attached = await getNoteImage(img.id);
    expect(attached).not.toBeNull();
    expect(attached!.note_id).toBe(note.id);
    expect(attached!.status).toBe("succeeded");
    expect(attached!.crop_x_min).toBeCloseTo(0.25);
    expect(attached!.crop_y_min).toBeCloseTo(0.25);
    expect(attached!.crop_x_max).toBeCloseTo(0.75);
    expect(attached!.crop_y_max).toBeCloseTo(0.75);

    expect(await fileExists(transientPath)).toBe(false);

    const persistedAbs = resolveImagePath(attached!.file_path);
    expect(await fileExists(persistedAbs)).toBe(true);
    const dims = await readImageDimensions(attached!.file_path);
    expect(dims.width).toBe(100);
    expect(dims.height).toBe(100);

    expect(attached!.thumbnail_path).not.toBeNull();
    const thumbAbs = resolveImagePath(attached!.thumbnail_path!);
    expect(await fileExists(thumbAbs)).toBe(true);
  }, 20000);

  it("creates a note with multiple images and per-image crops", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("NoteSave MultiImage");
    const imgA = await createPendingImageWithFiles(hen.id, ADMIN_EMAIL, 200, 200);
    const imgB = await createPendingImageWithFiles(hen.id, ADMIN_EMAIL, 300, 300);

    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes`,
      {
        content: "Multi-image note",
        date: "2026-07-18",
        imageIds: [imgA.id, imgB.id],
        crops: {
          [String(imgA.id)]: { x_min: 0, y_min: 0, x_max: 0.5, y_max: 0.5 },
          [String(imgB.id)]: { x_min: 0.1, y_min: 0.1, x_max: 0.9, y_max: 0.9 },
        },
      }
    );
    const response = await createNoteRoute(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(201);

    const attachedA = await getNoteImage(imgA.id);
    expect(attachedA!.status).toBe("succeeded");
    expect(attachedA!.crop_x_min).toBeCloseTo(0);
    expect(attachedA!.crop_x_max).toBeCloseTo(0.5);

    const attachedB = await getNoteImage(imgB.id);
    expect(attachedB!.status).toBe("succeeded");
    expect(attachedB!.crop_x_min).toBeCloseTo(0.1);
    expect(attachedB!.crop_x_max).toBeCloseTo(0.9);

    const noteImages = await listNoteImagesByNote((await response.json()).id);
    expect(noteImages.length).toBe(2);
  }, 20000);

  it("discards un-referenced pending images on note save", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("NoteSave DiscardUnref");
    const referenced = await createPendingImageWithFiles(hen.id, ADMIN_EMAIL);
    const unreferenced = await createPendingImageWithFiles(hen.id, ADMIN_EMAIL);

    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes`,
      {
        content: "Only one image",
        date: "2026-07-18",
        imageIds: [referenced.id],
      }
    );
    const response = await createNoteRoute(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(201);

    const attachedRef = await getNoteImage(referenced.id);
    expect(attachedRef!.note_id).not.toBeNull();

    expect(await getNoteImage(unreferenced.id)).toBeNull();

    const remaining = await listPendingNoteImagesByChicken(hen.id);
    expect(remaining.length).toBe(0);
  }, 20000);

  it("returns 409 when an imageId is not pending (already attached)", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("NoteSave Conflict");
    const existingNote = await createNote({
      chicken_id: hen.id,
      content: "existing",
      date: "2026-07-17",
      recorded_by: ADMIN_EMAIL,
    });
    const img = await createPendingImageWithFiles(hen.id, ADMIN_EMAIL);
    await attachPendingNoteImageToNote(img.id, existingNote.id, {
      cropped_file_path: `notes/already_attached_${randomUUID()}.png`,
      crop_x_min: 0,
      crop_y_min: 0,
      crop_x_max: 1,
      crop_y_max: 1,
    });

    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes`,
      {
        content: "Try to re-attach",
        date: "2026-07-18",
        imageIds: [img.id],
      }
    );
    const response = await createNoteRoute(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(409);
    const data = (await response.json()) as { message: string };
    expect(data.message).toMatch(/not pending/i);
  }, 20000);

  it("rejects a Viewer attaching another user's image with 403", async () => {
    setSession({ email: VIEWER_EMAIL, role: "Viewer" });
    const hen = await ensureHen("NoteSave ViewerOther");
    const img = await createPendingImageWithFiles(hen.id, OTHER_EMAIL);

    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes`,
      {
        content: "Viewer tries other's image",
        date: "2026-07-18",
        imageIds: [img.id],
      }
    );
    const response = await createNoteRoute(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(403);

    expect(await getNoteImage(img.id)).not.toBeNull();
    expect((await getNoteImage(img.id))!.note_id).toBeNull();
  }, 15000);

  it("Admin can attach a Viewer's image", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("NoteSave AdminAttach");
    const img = await createPendingImageWithFiles(hen.id, VIEWER_EMAIL);

    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes`,
      {
        content: "Admin attaches viewer's image",
        date: "2026-07-18",
        imageIds: [img.id],
      }
    );
    const response = await createNoteRoute(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(201);

    const attached = await getNoteImage(img.id);
    expect(attached!.note_id).not.toBeNull();
    expect(attached!.status).toBe("succeeded");
  }, 15000);

  it("uses full image crop when no override and no existing crop", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("NoteSave FullCrop");
    const img = await createPendingImageWithFiles(hen.id, ADMIN_EMAIL, 100, 100);

    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes`,
      {
        content: "Full image",
        date: "2026-07-18",
        imageIds: [img.id],
      }
    );
    const response = await createNoteRoute(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(201);

    const attached = await getNoteImage(img.id);
    expect(attached!.crop_x_min).toBeCloseTo(0);
    expect(attached!.crop_y_min).toBeCloseTo(0);
    expect(attached!.crop_x_max).toBeCloseTo(1);
    expect(attached!.crop_y_max).toBeCloseTo(1);

    const dims = await readImageDimensions(attached!.file_path);
    expect(dims.width).toBe(100);
    expect(dims.height).toBe(100);
  }, 15000);
});

describe("PUT /api/chickens/[id]/notes/[noteId] — note edit with images", () => {
  it("attaches new images to an existing note", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("NoteEdit Attach");
    const note = await createNote({
      chicken_id: hen.id,
      content: "Original",
      date: "2026-07-17",
      recorded_by: ADMIN_EMAIL,
    });
    const img = await createPendingImageWithFiles(hen.id, ADMIN_EMAIL, 200, 200);

    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/${note.id}`,
      {
        content: "Updated",
        imageIds: [img.id],
        crops: {
          [String(img.id)]: { x_min: 0.1, y_min: 0.1, x_max: 0.9, y_max: 0.9 },
        },
      },
      "PUT"
    );
    const response = await updateNoteRoute(request, {
      params: Promise.resolve({ id: String(hen.id), noteId: String(note.id) }),
    });
    expect(response.status).toBe(200);

    const attached = await getNoteImage(img.id);
    expect(attached!.note_id).toBe(note.id);
    expect(attached!.status).toBe("succeeded");
    expect(attached!.crop_x_min).toBeCloseTo(0.1);

    const updated = await getNote(note.id);
    expect(updated!.content).toBe("Updated");
  }, 20000);

  it("discards un-referenced pending images on note edit", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("NoteEdit Discard");
    const note = await createNote({
      chicken_id: hen.id,
      content: "Edit discard test",
      date: "2026-07-17",
      recorded_by: ADMIN_EMAIL,
    });
    const img = await createPendingImageWithFiles(hen.id, ADMIN_EMAIL);
    const orphan = await createPendingImageWithFiles(hen.id, ADMIN_EMAIL);

    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/${note.id}`,
      {
        imageIds: [img.id],
      },
      "PUT"
    );
    const response = await updateNoteRoute(request, {
      params: Promise.resolve({ id: String(hen.id), noteId: String(note.id) }),
    });
    expect(response.status).toBe(200);

    expect(await getNoteImage(img.id)).not.toBeNull();
    expect(await getNoteImage(orphan.id)).toBeNull();
  }, 20000);

  it("succeeds when editing a note that already has images attached (no 409)", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("NoteEdit ExistingImages");
    const note = await createNote({
      chicken_id: hen.id,
      content: "Original with image",
      date: "2026-07-17",
      recorded_by: ADMIN_EMAIL,
    });
    const img = await createPendingImageWithFiles(hen.id, ADMIN_EMAIL, 200, 200);

    const createReq = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/${note.id}`,
      { content: "First edit", imageIds: [img.id] },
      "PUT"
    );
    const createRes = await updateNoteRoute(createReq, {
      params: Promise.resolve({ id: String(hen.id), noteId: String(note.id) }),
    });
    expect(createRes.status).toBe(200);

    const editReq = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/${note.id}`,
      { content: "Second edit", imageIds: [img.id] },
      "PUT"
    );
    const editRes = await updateNoteRoute(editReq, {
      params: Promise.resolve({ id: String(hen.id), noteId: String(note.id) }),
    });
    expect(editRes.status).toBe(200);

    const updated = await getNote(note.id);
    expect(updated!.content).toBe("Second edit");

    const attached = await getNoteImage(img.id);
    expect(attached).not.toBeNull();
    expect(attached!.note_id).toBe(note.id);
  }, 20000);

  it("removes images no longer in the imageIds list on edit", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("NoteEdit RemoveImages");
    const note = await createNote({
      chicken_id: hen.id,
      content: "Note with two images",
      date: "2026-07-17",
      recorded_by: ADMIN_EMAIL,
    });
    const imgA = await createPendingImageWithFiles(hen.id, ADMIN_EMAIL, 100, 100);
    const imgB = await createPendingImageWithFiles(hen.id, ADMIN_EMAIL, 100, 100);

    const attachReq = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/${note.id}`,
      { content: "Note with two images", imageIds: [imgA.id, imgB.id] },
      "PUT"
    );
    const attachRes = await updateNoteRoute(attachReq, {
      params: Promise.resolve({ id: String(hen.id), noteId: String(note.id) }),
    });
    expect(attachRes.status).toBe(200);
    expect(await listNoteImagesByNote(note.id)).toHaveLength(2);

    const removeReq = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/${note.id}`,
      { content: "Note with one image", imageIds: [imgA.id] },
      "PUT"
    );
    const removeRes = await updateNoteRoute(removeReq, {
      params: Promise.resolve({ id: String(hen.id), noteId: String(note.id) }),
    });
    expect(removeRes.status).toBe(200);

    const remaining = await listNoteImagesByNote(note.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.id).toBe(imgA.id);

    expect(await getNoteImage(imgB.id)).toBeNull();
  }, 20000);

  it("returns 409 when attaching an already-attached image", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("NoteEdit Conflict");
    const note1 = await createNote({
      chicken_id: hen.id,
      content: "first",
      date: "2026-07-16",
      recorded_by: ADMIN_EMAIL,
    });
    const note2 = await createNote({
      chicken_id: hen.id,
      content: "second",
      date: "2026-07-17",
      recorded_by: ADMIN_EMAIL,
    });
    const img = await createPendingImageWithFiles(hen.id, ADMIN_EMAIL);
    await attachPendingNoteImageToNote(img.id, note1.id, {
      cropped_file_path: `notes/edit_conflict_${randomUUID()}.png`,
      crop_x_min: 0,
      crop_y_min: 0,
      crop_x_max: 1,
      crop_y_max: 1,
    });

    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/${note2.id}`,
      {
        imageIds: [img.id],
      },
      "PUT"
    );
    const response = await updateNoteRoute(request, {
      params: Promise.resolve({ id: String(hen.id), noteId: String(note2.id) }),
    });
    expect(response.status).toBe(409);
  }, 20000);
});

describe("DELETE /api/chickens/[id]/notes/[noteId] — note delete with images", () => {
  it("cleans up note image files and rows when deleting a note", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("NoteDelete Cleanup");
    const note = await createNote({
      chicken_id: hen.id,
      content: "To be deleted with images",
      date: "2026-07-18",
      recorded_by: ADMIN_EMAIL,
    });

    const imgA = await createPendingImageWithFiles(hen.id, ADMIN_EMAIL, 100, 100);
    const imgB = await createPendingImageWithFiles(hen.id, ADMIN_EMAIL, 100, 100);

    const croppedA = `notes/del_a_${randomUUID()}.png`;
    const croppedB = `notes/del_b_${randomUUID()}.png`;
    const buf = await makePngBuffer(50, 50);
    await writeFile(resolveImagePath(croppedA), buf);
    await writeFile(resolveImagePath(croppedB), buf);

    await attachPendingNoteImageToNote(imgA.id, note.id, {
      cropped_file_path: croppedA,
      thumbnail_path: `notes/del_a_thumb_${randomUUID()}.webp`,
      crop_x_min: 0,
      crop_y_min: 0,
      crop_x_max: 1,
      crop_y_max: 1,
    });
    await attachPendingNoteImageToNote(imgB.id, note.id, {
      cropped_file_path: croppedB,
      thumbnail_path: `notes/del_b_thumb_${randomUUID()}.webp`,
      crop_x_min: 0,
      crop_y_min: 0,
      crop_x_max: 1,
      crop_y_max: 1,
    });

    const attachedA = await getNoteImage(imgA.id);
    const attachedB = await getNoteImage(imgB.id);
    const fileA = resolveImagePath(attachedA!.file_path);
    const fileB = resolveImagePath(attachedB!.file_path);
    const thumbA = attachedA!.thumbnail_path ? resolveImagePath(attachedA!.thumbnail_path) : null;
    const thumbB = attachedB!.thumbnail_path ? resolveImagePath(attachedB!.thumbnail_path) : null;

    await writeFile(resolveImagePath(attachedA!.thumbnail_path!), buf);
    await writeFile(resolveImagePath(attachedB!.thumbnail_path!), buf);

    expect(await fileExists(fileA)).toBe(true);
    expect(await fileExists(fileB)).toBe(true);

    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/${note.id}`,
      {},
      "DELETE"
    );
    const response = await deleteNoteRoute(request, {
      params: Promise.resolve({ id: String(hen.id), noteId: String(note.id) }),
    });
    expect(response.status).toBe(200);

    expect(await getNote(note.id)).toBeNull();
    expect(await listNoteImagesByNote(note.id)).toHaveLength(0);
    expect(await fileExists(fileA)).toBe(false);
    expect(await fileExists(fileB)).toBe(false);
    if (thumbA) expect(await fileExists(thumbA)).toBe(false);
    if (thumbB) expect(await fileExists(thumbB)).toBe(false);
  }, 20000);
});

describe("DELETE /api/chickens/[id] — chicken delete with cascading cleanup", () => {
  it("rejects non-Admin with 403", async () => {
    setSession({ email: VIEWER_EMAIL, role: "Viewer" });
    const hen = await ensureHen("ChickenDelete Viewer");
    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}`,
      {},
      "DELETE"
    );
    const response = await deleteChickenRoute(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(403);
  }, 15000);

  it("rejects unauthenticated with 401", async () => {
    setSession(null);
    const hen = await ensureHen("ChickenDelete Unauth");
    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}`,
      {},
      "DELETE"
    );
    const response = await deleteChickenRoute(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(401);
  }, 15000);

  it("returns 404 for a non-existent chicken", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const request = buildJsonRequest(
      "http://localhost/api/chickens/999999",
      {},
      "DELETE"
    );
    const response = await deleteChickenRoute(request, {
      params: Promise.resolve({ id: "999999" }),
    });
    expect(response.status).toBe(404);
  }, 15000);

  it("hard-deletes the chicken, cleans up note-image files, and cascades notes + note_images", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("ChickenDelete Cascade");

    const note = await createNote({
      chicken_id: hen.id,
      content: "Will be cascade-deleted",
      date: "2026-07-18",
      recorded_by: ADMIN_EMAIL,
    });

    const imgA = await createPendingImageWithFiles(hen.id, ADMIN_EMAIL, 100, 100);
    const imgB = await createPendingImageWithFiles(hen.id, ADMIN_EMAIL, 100, 100);

    const croppedA = `notes/chicken_del_a_${randomUUID()}.png`;
    const croppedB = `notes/chicken_del_b_${randomUUID()}.png`;
    const buf = await makePngBuffer(50, 50);
    await writeFile(resolveImagePath(croppedA), buf);
    await writeFile(resolveImagePath(croppedB), buf);

    await attachPendingNoteImageToNote(imgA.id, note.id, {
      cropped_file_path: croppedA,
      crop_x_min: 0,
      crop_y_min: 0,
      crop_x_max: 1,
      crop_y_max: 1,
    });
    await attachPendingNoteImageToNote(imgB.id, note.id, {
      cropped_file_path: croppedB,
      crop_x_min: 0,
      crop_y_min: 0,
      crop_x_max: 1,
      crop_y_max: 1,
    });

    const attachedA = await getNoteImage(imgA.id);
    const attachedB = await getNoteImage(imgB.id);
    const fileA = resolveImagePath(attachedA!.file_path);
    const fileB = resolveImagePath(attachedB!.file_path);

    expect(await fileExists(fileA)).toBe(true);
    expect(await fileExists(fileB)).toBe(true);

    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}`,
      {},
      "DELETE"
    );
    const response = await deleteChickenRoute(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(204);

    const pool = await getPool();
    const chickenResult = await pool
      .request()
      .input("id", require("mssql").Int, hen.id)
      .query("SELECT * FROM chickens WHERE id = @id");
    expect(chickenResult.recordset.length).toBe(0);

    const noteResult = await pool
      .request()
      .input("id", require("mssql").Int, note.id)
      .query("SELECT * FROM notes WHERE id = @id");
    expect(noteResult.recordset.length).toBe(0);

    expect(await fileExists(fileA)).toBe(false);
    expect(await fileExists(fileB)).toBe(false);
  }, 25000);
});
