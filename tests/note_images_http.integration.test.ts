jest.mock("next-auth", () => ({
  __esModule: true,
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/ai", () => ({
  processNoteImage: jest.fn(() => Promise.resolve()),
}));

import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import {
  ensureDatabase,
  closePool,
  getPool,
  ensureMigrations,
} from "@/lib/db";
import { createChicken, listChickens, type Chicken } from "@/lib/chickens";
import { addUser, getUserByEmail } from "@/lib/users";
import {
  createPendingNoteImage,
  attachPendingNoteImageToNote,
  getNoteImage,
  updateNoteImageStatus,
  type NoteImage,
} from "@/lib/note_images";
import {
  getNotesImageDirectory,
  getPendingImageDirectory,
  resolveImagePath,
  readImageDimensions,
} from "@/lib/image-storage";
import { POST as uploadNoteImage, GET as listOrUploadNoteImage } from "@/app/api/chickens/[id]/notes/images/route";
import { POST as discardBatch } from "@/app/api/chickens/[id]/notes/images/discard-batch/route";
import { GET as getNoteImageRoute, PATCH as patchNoteImage } from "@/app/api/chickens/[id]/notes/images/[imageId]/route";
import { GET as readNoteImageFile } from "@/app/api/notes/images/[filename]/route";
import { POST as sweepOrphans } from "@/app/api/internal/sweep-orphans/route";
import sharp from "sharp";
import { writeFile, mkdir, rm, stat } from "fs/promises";
import { join, resolve } from "path";
import { randomUUID } from "crypto";

const TEST_IMAGE_DIR = resolve(process.cwd(), "images-test-http");
process.env.IMAGE_DIR = TEST_IMAGE_DIR;

const ADMIN_EMAIL = "test-http-admin@example.com";
const VIEWER_EMAIL = "test-http-viewer@example.com";
const OTHER_EMAIL = "test-http-other@example.com";

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

function buildFormData(
  buffer: Buffer,
  filename: string,
  type: string
): FormData {
  const form = new FormData();
  const ab = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(ab).set(buffer);
  const blob = new Blob([ab], { type });
  form.append("file", blob, filename);
  return form;
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

function buildFormRequest(
  url: string,
  form: FormData,
  method: string = "POST"
): NextRequest {
  return new NextRequest(url, { method, body: form });
}

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await stat(absPath);
    return true;
  } catch {
    return false;
  }
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

describe("POST /api/chickens/[id]/notes/images — upload", () => {
  it("rejects unauthenticated requests with 401", async () => {
    setSession(null);
    const hen = await ensureHen("Upload Unauth");
    const buf = await makePngBuffer(50, 50);
    const form = buildFormData(buf, "x.png", "image/png");
    const request = buildFormRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images`,
      form
    );

    const response = await uploadNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(401);
  }, 15000);

  it("rejects when the chicken does not exist with 404", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const buf = await makePngBuffer(50, 50);
    const form = buildFormData(buf, "x.png", "image/png");
    const request = buildFormRequest(
      "http://localhost/api/chickens/999999/notes/images",
      form
    );

    const response = await uploadNoteImage(request, {
      params: Promise.resolve({ id: "999999" }),
    });
    expect(response.status).toBe(404);
  }, 15000);

  it("rejects when the file field is missing with 400", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("Upload MissingFile");
    const form = new FormData();
    const request = buildFormRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images`,
      form
    );

    const response = await uploadNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(400);
  }, 15000);

  it("rejects files over the 10 MB size limit with 400", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("Upload TooBig");
    const huge = Buffer.alloc(45 * 1024 * 1024);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(huge);
    const form = buildFormData(huge, "huge.png", "image/png");
    const request = buildFormRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images`,
      form
    );

    const response = await uploadNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.message).toMatch(/size/i);
  }, 30000);

  it("rejects disallowed MIME types with 400", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("Upload BadMime");
    const buf = await makePngBuffer(50, 50);
    const form = buildFormData(buf, "x.png", "text/plain");
    const request = buildFormRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images`,
      form
    );

    const response = await uploadNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toMatch(/type/i);
  }, 15000);

  it("rejects content that fails magic-byte validation with 400", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("Upload BadMagic");
    const buf = Buffer.from("not an image, just text");
    const form = buildFormData(buf, "fake.png", "image/png");
    const request = buildFormRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images`,
      form
    );

    const response = await uploadNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toMatch(/content/i);
  }, 15000);

  it("writes the transient file + thumbnail and inserts a pending row", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("Upload Happy");
    const buf = await makePngBuffer(120, 80);
    const form = buildFormData(buf, "vet-receipt.png", "image/png");
    const request = buildFormRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images`,
      form
    );

    const response = await uploadNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(201);
    const row = (await response.json()) as NoteImage;
    expect(row.chicken_id).toBe(hen.id);
    expect(row.status).toBe("pending");
    expect(row.note_id).toBeNull();
    expect(row.file_path).toMatch(/^notes\/_pending\//);
    expect(row.file_path.endsWith(".png")).toBe(true);
    expect(row.original_width).toBe(120);
    expect(row.original_height).toBe(80);
    expect(row.recorded_by).toBe(ADMIN_EMAIL);

    const absFile = resolveImagePath(row.file_path);
    expect(await fileExists(absFile)).toBe(true);

    const pendingDir = getPendingImageDirectory();
    const baseName = row.file_path.split("/").pop()!.replace(/\.[^.]+$/, "");
    const thumbPath = join(pendingDir, `${baseName}_thumb.webp`);
    expect(await fileExists(thumbPath)).toBe(true);
  }, 15000);

  it("records a Viewer as the recorded_by on upload", async () => {
    setSession({ email: VIEWER_EMAIL, role: "Viewer" });
    const hen = await ensureHen("Upload Viewer");
    const buf = await makePngBuffer(50, 50);
    const form = buildFormData(buf, "viewer.png", "image/png");
    const request = buildFormRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images`,
      form
    );

    const response = await uploadNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(201);
    const row = (await response.json()) as NoteImage;
    expect(row.recorded_by).toBe(VIEWER_EMAIL);
  }, 15000);
});

describe("GET /api/chickens/[id]/notes/images — list", () => {
  it("rejects unauthenticated requests with 401", async () => {
    setSession(null);
    const hen = await ensureHen("List Unauth");
    const request = new NextRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images?pending=true`
    );
    const response = await listOrUploadNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(401);
  }, 15000);

  it("returns 404 when the chicken does not exist", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const request = new NextRequest(
      "http://localhost/api/chickens/999999/notes/images?pending=true"
    );
    const response = await listOrUploadNoteImage(request, {
      params: Promise.resolve({ id: "999999" }),
    });
    expect(response.status).toBe(404);
  }, 15000);

  it("returns 400 when neither noteId nor pending=true is supplied", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("List MissingQuery");
    const request = new NextRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images`
    );
    const response = await listOrUploadNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(400);
  }, 15000);

  it("returns only this chicken's pending images", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const henA = await ensureHen("List Pending A");
    const henB = await ensureHen("List Pending B");
    await createPendingNoteImage({
      chicken_id: henA.id,
      file_path: `notes/_pending/a_${randomUUID()}.png`,
      original_width: 50,
      original_height: 50,
      recorded_by: ADMIN_EMAIL,
    });
    await createPendingNoteImage({
      chicken_id: henB.id,
      file_path: `notes/_pending/b_${randomUUID()}.png`,
      original_width: 50,
      original_height: 50,
      recorded_by: ADMIN_EMAIL,
    });

    const request = new NextRequest(
      `http://localhost/api/chickens/${henA.id}/notes/images?pending=true`
    );
    const response = await listOrUploadNoteImage(request, {
      params: Promise.resolve({ id: String(henA.id) }),
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as NoteImage[];
    expect(data).toHaveLength(1);
    expect(data[0]!.chicken_id).toBe(henA.id);
  }, 15000);

  it("returns images attached to a note when ?noteId= is given", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("List ByNote");
    const { createNote } = await import("@/lib/notes");
    const note = await createNote({
      chicken_id: hen.id,
      content: "with images",
      date: "2026-07-10",
      recorded_by: ADMIN_EMAIL,
    });
    const a = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/n1_${randomUUID()}.png`,
      original_width: 50,
      original_height: 50,
      recorded_by: ADMIN_EMAIL,
    });
    await attachPendingNoteImageToNote(a.id, note.id, {
      cropped_file_path: `notes/cropped_${randomUUID()}.png`,
      crop_x_min: 0,
      crop_y_min: 0,
      crop_x_max: 1,
      crop_y_max: 1,
    });

    const request = new NextRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images?noteId=${note.id}`
    );
    const response = await listOrUploadNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as NoteImage[];
    expect(data).toHaveLength(1);
    expect(data[0]!.note_id).toBe(note.id);
  }, 15000);
});

describe("GET /api/chickens/[id]/notes/images/[imageId] — single", () => {
  it("rejects unauthenticated requests with 401", async () => {
    setSession(null);
    const hen = await ensureHen("Single Unauth");
    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/sa_${randomUUID()}.png`,
      original_width: 50,
      original_height: 50,
      recorded_by: ADMIN_EMAIL,
    });
    const request = new NextRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/${img.id}`
    );
    const response = await getNoteImageRoute(request, {
      params: Promise.resolve({ id: String(hen.id), imageId: String(img.id) }),
    });
    expect(response.status).toBe(401);
  }, 15000);

  it("returns 404 when the image belongs to a different chicken", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const henA = await ensureHen("Single WrongChicken A");
    const henB = await ensureHen("Single WrongChicken B");
    const img = await createPendingNoteImage({
      chicken_id: henA.id,
      file_path: `notes/_pending/wc_${randomUUID()}.png`,
      original_width: 50,
      original_height: 50,
      recorded_by: ADMIN_EMAIL,
    });
    const request = new NextRequest(
      `http://localhost/api/chickens/${henB.id}/notes/images/${img.id}`
    );
    const response = await getNoteImageRoute(request, {
      params: Promise.resolve({ id: String(henB.id), imageId: String(img.id) }),
    });
    expect(response.status).toBe(404);
  }, 15000);

  it("returns the image row when scoped correctly", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("Single Happy");
    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/h_${randomUUID()}.png`,
      original_width: 50,
      original_height: 50,
      recorded_by: ADMIN_EMAIL,
    });
    const request = new NextRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/${img.id}`
    );
    const response = await getNoteImageRoute(request, {
      params: Promise.resolve({ id: String(hen.id), imageId: String(img.id) }),
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as NoteImage;
    expect(data.id).toBe(img.id);
    expect(data.status).toBe("pending");
  }, 15000);
});

describe("PATCH /api/chickens/[id]/notes/images/[imageId]", () => {
  it("rejects unauthenticated requests with 401", async () => {
    setSession(null);
    const hen = await ensureHen("Patch Unauth");
    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/pu_${randomUUID()}.png`,
      original_width: 50,
      original_height: 50,
      recorded_by: ADMIN_EMAIL,
    });
    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/${img.id}`,
      { action: "discard" },
      "PATCH"
    );
    const response = await patchNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id), imageId: String(img.id) }),
    });
    expect(response.status).toBe(401);
  }, 15000);

  it("rejects a Viewer mutating another user's image with 403", async () => {
    setSession({ email: OTHER_EMAIL, role: "Viewer" });
    const hen = await ensureHen("Patch ViewerOther");
    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/pvo_${randomUUID()}.png`,
      original_width: 50,
      original_height: 50,
      recorded_by: ADMIN_EMAIL,
    });
    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/${img.id}`,
      { action: "discard" },
      "PATCH"
    );
    const response = await patchNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id), imageId: String(img.id) }),
    });
    expect(response.status).toBe(403);
  }, 15000);

  it("updates the crop region on a pending row when owned by the caller", async () => {
    setSession({ email: VIEWER_EMAIL, role: "Viewer" });
    const hen = await ensureHen("Patch Crop Owner");
    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/pco_${randomUUID()}.png`,
      original_width: 100,
      original_height: 100,
      recorded_by: VIEWER_EMAIL,
    });
    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/${img.id}`,
      {
        action: "crop",
        crop: { x_min: 0.1, y_min: 0.2, x_max: 0.9, y_max: 0.8 },
      },
      "PATCH"
    );
    const response = await patchNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id), imageId: String(img.id) }),
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as NoteImage;
    expect(data.crop_x_min).toBeCloseTo(0.1);
    expect(data.crop_y_min).toBeCloseTo(0.2);
    expect(data.crop_x_max).toBeCloseTo(0.9);
    expect(data.crop_y_max).toBeCloseTo(0.8);
    expect(data.note_id).toBeNull();
  }, 15000);

  it("returns 409 when adjusting crop on an image already attached to a note", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("Patch Crop Conflict");
    const { createNote } = await import("@/lib/notes");
    const note = await createNote({
      chicken_id: hen.id,
      content: "with image",
      date: "2026-07-12",
      recorded_by: ADMIN_EMAIL,
    });
    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/pcc_${randomUUID()}.png`,
      original_width: 100,
      original_height: 100,
      recorded_by: ADMIN_EMAIL,
    });
    await attachPendingNoteImageToNote(img.id, note.id, {
      cropped_file_path: `notes/cropped_${randomUUID()}.png`,
      crop_x_min: 0,
      crop_y_min: 0,
      crop_x_max: 1,
      crop_y_max: 1,
    });

    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/${img.id}`,
      {
        action: "crop",
        crop: { x_min: 0.1, y_min: 0.1, x_max: 0.9, y_max: 0.9 },
      },
      "PATCH"
    );
    const response = await patchNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id), imageId: String(img.id) }),
    });
    expect(response.status).toBe(409);
  }, 15000);

  it("returns 409 when adjusting crop on an image in a non-pre-save status", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("Patch Crop FailedStatus");
    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/pcf_${randomUUID()}.png`,
      original_width: 100,
      original_height: 100,
      recorded_by: ADMIN_EMAIL,
    });
    await updateNoteImageStatus(img.id, "failed", { ai_error: "nope" });

    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/${img.id}`,
      {
        action: "crop",
        crop: { x_min: 0.1, y_min: 0.1, x_max: 0.9, y_max: 0.9 },
      },
      "PATCH"
    );
    const response = await patchNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id), imageId: String(img.id) }),
    });
    expect(response.status).toBe(409);
  }, 15000);

  it("discards the image and removes its file when the action is discard", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("Patch Discard");
    const filename = `notes/_pending/pd_${randomUUID()}.png`;
    const absFile = resolveImagePath(filename);
    await writeFile(absFile, await makePngBuffer(20, 20));
    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: filename,
      original_width: 20,
      original_height: 20,
      recorded_by: ADMIN_EMAIL,
    });

    expect(await fileExists(absFile)).toBe(true);

    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/${img.id}`,
      { action: "discard" },
      "PATCH"
    );
    const response = await patchNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id), imageId: String(img.id) }),
    });
    expect(response.status).toBe(200);
    expect(await getNoteImage(img.id)).toBeNull();
    expect(await fileExists(absFile)).toBe(false);
  }, 15000);

  it("discard is idempotent (the data layer swallows the no-op; the route returns 404 for a missing row)", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("Patch Discard Idem");
    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/pdi_${randomUUID()}.png`,
      original_width: 20,
      original_height: 20,
      recorded_by: ADMIN_EMAIL,
    });

    const first = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/${img.id}`,
      { action: "discard" },
      "PATCH"
    );
    const r1 = await patchNoteImage(first, {
      params: Promise.resolve({ id: String(hen.id), imageId: String(img.id) }),
    });
    expect(r1.status).toBe(200);

    const second = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/${img.id}`,
      { action: "discard" },
      "PATCH"
    );
    const r2 = await patchNoteImage(second, {
      params: Promise.resolve({ id: String(hen.id), imageId: String(img.id) }),
    });
    expect(r2.status).toBe(404);
  }, 15000);

  it("rejects an unknown action with 400", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("Patch BadAction");
    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/pba_${randomUUID()}.png`,
      original_width: 20,
      original_height: 20,
      recorded_by: ADMIN_EMAIL,
    });
    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/${img.id}`,
      { action: "wat" },
      "PATCH"
    );
    const response = await patchNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id), imageId: String(img.id) }),
    });
    expect(response.status).toBe(400);
  }, 15000);
});

describe("POST /api/chickens/[id]/notes/images/discard-batch", () => {
  it("rejects unauthenticated requests with 401", async () => {
    setSession(null);
    const hen = await ensureHen("Batch Unauth");
    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/discard-batch`,
      { imageIds: [1, 2, 3] }
    );
    const response = await discardBatch(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(401);
  }, 15000);

  it("rejects a non-array body with 400", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("Batch BadBody");
    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/discard-batch`,
      { imageIds: "nope" }
    );
    const response = await discardBatch(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(400);
  }, 15000);

  it("discards all of the viewer's own pending images and is idempotent", async () => {
    setSession({ email: VIEWER_EMAIL, role: "Viewer" });
    const hen = await ensureHen("Batch Happy");
    const a = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/bh_a_${randomUUID()}.png`,
      original_width: 20,
      original_height: 20,
      recorded_by: VIEWER_EMAIL,
    });
    const b = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/bh_b_${randomUUID()}.png`,
      original_width: 20,
      original_height: 20,
      recorded_by: VIEWER_EMAIL,
    });

    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/discard-batch`,
      { imageIds: [a.id, b.id] }
    );
    const response = await discardBatch(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      discarded: number;
      skipped: number;
    };
    expect(data.discarded).toBe(2);
    expect(data.skipped).toBe(0);
    expect(await getNoteImage(a.id)).toBeNull();
    expect(await getNoteImage(b.id)).toBeNull();

    const second = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/discard-batch`,
      { imageIds: [a.id, b.id] }
    );
    const r2 = await discardBatch(second, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(r2.status).toBe(200);
    const d2 = (await r2.json()) as { discarded: number; skipped: number };
    expect(d2.discarded).toBe(0);
  }, 15000);

  it("skips images that belong to other users (Viewer can only discard own)", async () => {
    setSession({ email: VIEWER_EMAIL, role: "Viewer" });
    const hen = await ensureHen("Batch SkipOther");
    const mine = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/bs_m_${randomUUID()}.png`,
      original_width: 20,
      original_height: 20,
      recorded_by: VIEWER_EMAIL,
    });
    const other = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/bs_o_${randomUUID()}.png`,
      original_width: 20,
      original_height: 20,
      recorded_by: OTHER_EMAIL,
    });
    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/discard-batch`,
      { imageIds: [mine.id, other.id] }
    );
    const response = await discardBatch(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      discarded: number;
      skipped: number;
    };
    expect(data.discarded).toBe(1);
    expect(data.skipped).toBe(1);
    expect(await getNoteImage(mine.id)).toBeNull();
    expect(await getNoteImage(other.id)).not.toBeNull();
  }, 15000);

  it("Admin can discard images from any user", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("Batch Admin");
    const a = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/ba_a_${randomUUID()}.png`,
      original_width: 20,
      original_height: 20,
      recorded_by: VIEWER_EMAIL,
    });
    const b = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/ba_b_${randomUUID()}.png`,
      original_width: 20,
      original_height: 20,
      recorded_by: OTHER_EMAIL,
    });
    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/discard-batch`,
      { imageIds: [a.id, b.id] }
    );
    const response = await discardBatch(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      discarded: number;
      skipped: number;
    };
    expect(data.discarded).toBe(2);
    expect(data.skipped).toBe(0);
  }, 15000);
});

describe("GET /api/notes/images/[filename] — read", () => {
  it("rejects unauthenticated requests with 401", async () => {
    setSession(null);
    const request = new NextRequest(
      "http://localhost/api/notes/images/whatever.png"
    );
    const response = await readNoteImageFile(request, {
      params: Promise.resolve({ filename: "whatever.png" }),
    });
    expect(response.status).toBe(401);
  }, 15000);

  it("rejects path-traversal attempts with 400", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const bad = ["..", "..\\etc.png", "../etc.png", "sub/x.png", "sub\\x.png"];
    for (const name of bad) {
      const request = new NextRequest(
        `http://localhost/api/notes/images/${encodeURIComponent(name)}`
      );
      const response = await readNoteImageFile(request, {
        params: Promise.resolve({ filename: name }),
      });
      expect(response.status).toBe(400);
    }
  }, 15000);

  it("returns 404 when the file does not exist", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const name = `nope_${randomUUID()}.png`;
    const request = new NextRequest(
      `http://localhost/api/notes/images/${name}`
    );
    const response = await readNoteImageFile(request, {
      params: Promise.resolve({ filename: name }),
    });
    expect(response.status).toBe(404);
  }, 15000);

  it("serves a file under IMAGE_DIR/notes/ with the right Content-Type and a cache header", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("Read Serve");
    const filename = `notes/_pending/rs_${randomUUID()}.png`;
    const absFile = resolveImagePath(filename);
    const buf = await makePngBuffer(40, 40);
    await writeFile(absFile, buf);

    const nameOnly = filename.split("/").pop()!;
    expect(nameOnly).toBeDefined();
    expect(nameOnly!.length).toBeGreaterThan(0);
    const request = new NextRequest(
      `http://localhost/api/notes/images/${nameOnly}`
    );
    const response = await readNoteImageFile(request, {
      params: Promise.resolve({ filename: nameOnly }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toMatch(/max-age/);
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.equals(buf)).toBe(true);
    expect(await readImageDimensions(filename)).toEqual({ width: 40, height: 40 });
  }, 15000);
});

describe("POST /api/internal/sweep-orphans", () => {
  it("rejects unauthenticated requests with 401", async () => {
    setSession(null);
    const request = buildJsonRequest(
      "http://localhost/api/internal/sweep-orphans",
      {}
    );
    const response = await sweepOrphans(request);
    expect(response.status).toBe(401);
  }, 15000);

  it("rejects non-Admin callers with 403", async () => {
    setSession({ email: VIEWER_EMAIL, role: "Viewer" });
    const request = buildJsonRequest(
      "http://localhost/api/internal/sweep-orphans",
      {}
    );
    const response = await sweepOrphans(request);
    expect(response.status).toBe(403);
  }, 15000);

  it("reaps only orphans older than the threshold and returns a count", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("Sweep Route");
    const pool = await getPool();
    const sql = await import("mssql");

    const old = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/so_${randomUUID()}.png`,
      original_width: 20,
      original_height: 20,
      recorded_by: ADMIN_EMAIL,
    });
    const fresh = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/sf_${randomUUID()}.png`,
      original_width: 20,
      original_height: 20,
      recorded_by: ADMIN_EMAIL,
    });
    await pool
      .request()
      .input("id", sql.default.Int, old.id)
      .input("past", sql.default.DateTime2, new Date(Date.now() - 48 * 60 * 60 * 1000))
      .query("UPDATE note_images SET created_at = @past WHERE id = @id");

    const request = buildJsonRequest(
      "http://localhost/api/internal/sweep-orphans",
      { olderThanHours: 24 }
    );
    const response = await sweepOrphans(request);
    expect(response.status).toBe(200);
    const data = (await response.json()) as { reaped: number; success: boolean };
    expect(data.success).toBe(true);
    expect(data.reaped).toBe(1);

    expect(await getNoteImage(old.id)).toBeNull();
    expect(await getNoteImage(fresh.id)).not.toBeNull();
  }, 15000);

  it("uses the default 24h threshold when the body omits olderThanHours", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("Sweep Default");
    const pool = await getPool();
    const sql = await import("mssql");
    const oldish = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/sd_${randomUUID()}.png`,
      original_width: 20,
      original_height: 20,
      recorded_by: ADMIN_EMAIL,
    });
    await pool
      .request()
      .input("id", sql.default.Int, oldish.id)
      .input("past", sql.default.DateTime2, new Date(Date.now() - 25 * 60 * 60 * 1000))
      .query("UPDATE note_images SET created_at = @past WHERE id = @id");

    const request = buildJsonRequest(
      "http://localhost/api/internal/sweep-orphans",
      {}
    );
    const response = await sweepOrphans(request);
    expect(response.status).toBe(200);
    const data = (await response.json()) as { reaped: number };
    expect(data.reaped).toBe(1);
  }, 15000);
});

describe("End-to-end smoke (upload → read → discard)", () => {
  it("serves a freshly uploaded image via the read route and discards it on demand", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("Smoke");

    const buf = await makePngBuffer(60, 60);
    const uploadForm = buildFormData(buf, "smoke.png", "image/png");
    const uploadRequest = buildFormRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images`,
      uploadForm
    );
    const uploadResponse = await uploadNoteImage(uploadRequest, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(uploadResponse.status).toBe(201);
    const row = (await uploadResponse.json()) as NoteImage;
    const nameOnly = row.file_path.split("/").pop()!;

    const readRequest = new NextRequest(
      `http://localhost/api/notes/images/${nameOnly}`
    );
    const readResponse = await readNoteImageFile(readRequest, {
      params: Promise.resolve({ filename: nameOnly }),
    });
    expect(readResponse.status).toBe(200);
    const served = Buffer.from(await readResponse.arrayBuffer());
    expect(served.equals(buf)).toBe(true);

    const pendingListRequest = new NextRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images?pending=true`
    );
    const listResponse = await listOrUploadNoteImage(pendingListRequest, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(listResponse.status).toBe(200);
    const list = (await listResponse.json()) as NoteImage[];
    expect(list.find((i) => i.id === row.id)).toBeDefined();

    const batchRequest = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/discard-batch`,
      { imageIds: [row.id] }
    );
    const batchResponse = await discardBatch(batchRequest, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(batchResponse.status).toBe(200);

    const readAgain = await readNoteImageFile(
      new NextRequest(`http://localhost/api/notes/images/${nameOnly}`),
      { params: Promise.resolve({ filename: nameOnly }) }
    );
    expect(readAgain.status).toBe(404);
  }, 20000);
});

