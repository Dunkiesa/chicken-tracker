jest.mock("next-auth", () => ({
  __esModule: true,
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/ai/orchestrator", () => ({
  processNoteImage: jest.fn(),
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
  getNoteImage,
  updateNoteImageStatus,
  type NoteImage,
} from "@/lib/note_images";
import {
  getNotesImageDirectory,
  getPendingImageDirectory,
} from "@/lib/image-storage";
import { POST as uploadNoteImage } from "@/app/api/chickens/[id]/notes/images/route";
import { GET as sseEvents } from "@/app/api/chickens/[id]/notes/images/events/route";
import { GET as getNoteImageRoute, PATCH as patchNoteImage } from "@/app/api/chickens/[id]/notes/images/[imageId]/route";
import { processNoteImage } from "@/lib/ai/orchestrator";
import {
  subscribeToStatusEvents,
  emitStatusEvent,
  _clearAllSubscribers,
} from "@/lib/ai/pubsub";
import { mkdir, rm } from "fs/promises";
import { resolve } from "path";
import { randomUUID } from "crypto";

const TEST_IMAGE_DIR = resolve(process.cwd(), "images-test-ai-integration");
process.env.IMAGE_DIR = TEST_IMAGE_DIR;

const ADMIN_EMAIL = "test-ai-int-admin@example.com";
const VIEWER_EMAIL = "test-ai-int-viewer@example.com";
const OTHER_EMAIL = "test-ai-int-other@example.com";

type SessionUser = { email: string; role: "Admin" | "Viewer" };
const mockedGetServerSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const mockProcessNoteImage = processNoteImage as jest.MockedFunction<
  typeof processNoteImage
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
  mockProcessNoteImage.mockReset();
  _clearAllSubscribers();
});

afterAll(async () => {
  await closePool();
  await rm(TEST_IMAGE_DIR, { recursive: true, force: true });
});

describe("Upload fire-and-forget", () => {
  it("returns the pending row immediately without waiting for processNoteImage", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("FireAndForget");

    let processResolve: (() => void) | null = null;
    const processPromise = new Promise<void>((resolve) => {
      processResolve = resolve;
    });
    mockProcessNoteImage.mockReturnValue(processPromise);

    const sharp = await import("sharp");
    const buf = await sharp.default({
      create: { width: 50, height: 50, channels: 3, background: { r: 90, g: 130, b: 210 } },
    }).png().toBuffer();

    const form = new FormData();
    const ab = new ArrayBuffer(buf.byteLength);
    new Uint8Array(ab).set(buf);
    const blob = new Blob([ab], { type: "image/png" });
    form.append("file", blob, "test.png");

    const request = new NextRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images`,
      { method: "POST", body: form }
    );

    const response = await uploadNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });

    expect(response.status).toBe(201);
    const row = (await response.json()) as NoteImage;
    expect(row.status).toBe("pending");

    expect(mockProcessNoteImage).toHaveBeenCalledWith(row.id, ADMIN_EMAIL);

    expect(processPromise).toBeDefined();
    processResolve!();
  }, 15000);

  it("swallows processNoteImage errors without affecting the response", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("FireAndForgetErr");

    mockProcessNoteImage.mockRejectedValue(new Error("AI exploded"));

    const sharp = await import("sharp");
    const buf = await sharp.default({
      create: { width: 50, height: 50, channels: 3, background: { r: 90, g: 130, b: 210 } },
    }).png().toBuffer();

    const form = new FormData();
    const ab = new ArrayBuffer(buf.byteLength);
    new Uint8Array(ab).set(buf);
    const blob = new Blob([ab], { type: "image/png" });
    form.append("file", blob, "test.png");

    const request = new NextRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images`,
      { method: "POST", body: form }
    );

    const response = await uploadNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });

    expect(response.status).toBe(201);

    await new Promise((r) => setTimeout(r, 50));
  }, 15000);
});

describe("SSE endpoint — GET /api/chickens/[id]/notes/images/events", () => {
  it("rejects unauthenticated requests with 401", async () => {
    setSession(null);
    const hen = await ensureHen("SSE Unauth");
    const request = new NextRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/events`
    );
    const response = await sseEvents(request, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(401);
  }, 15000);

  it("returns 404 for a non-existent chicken", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const request = new NextRequest(
      "http://localhost/api/chickens/999999/notes/images/events"
    );
    const response = await sseEvents(request, {
      params: Promise.resolve({ id: "999999" }),
    });
    expect(response.status).toBe(404);
  }, 15000);

  it("returns text/event-stream content type for an authenticated request", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("SSE ContentType");
    const request = new NextRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/events`
    );

    const controller = new AbortController();
    const abortableReq = new NextRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/events`,
      { signal: controller.signal }
    );

    const response = await sseEvents(abortableReq, {
      params: Promise.resolve({ id: String(hen.id) }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");

    controller.abort();
    await new Promise((r) => setTimeout(r, 50));
  }, 15000);

  it("delivers events scoped to the user and chicken via the pub-sub", async () => {
    setSession({ email: VIEWER_EMAIL, role: "Viewer" });
    const hen = await ensureHen("SSE Delivery");

    const received: string[] = [];
    const unsubscribe = subscribeToStatusEvents(VIEWER_EMAIL, (payload) => {
      if (payload.chickenId !== hen.id) return;
      received.push(JSON.stringify({ imageId: payload.imageId, status: payload.status }));
    });

    emitStatusEvent(VIEWER_EMAIL, {
      imageId: 1,
      chickenId: hen.id,
      status: "processing",
    });
    emitStatusEvent(VIEWER_EMAIL, {
      imageId: 2,
      chickenId: hen.id + 999,
      status: "processing",
    });
    emitStatusEvent(OTHER_EMAIL, {
      imageId: 3,
      chickenId: hen.id,
      status: "succeeded",
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toContain('"imageId":1');
    expect(received[0]).toContain('"status":"processing"');

    unsubscribe();
  }, 15000);
});

describe("Reconcile-on-reconnect — GET single image", () => {
  it("returns the current state of an image for reconciliation", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("Reconcile");
    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/rec_${randomUUID()}.png`,
      original_width: 50,
      original_height: 50,
      recorded_by: ADMIN_EMAIL,
    });

    await updateNoteImageStatus(img.id, "succeeded", {
      ai_suggestion: "A hen sitting on eggs",
    });

    const request = new NextRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/${img.id}`
    );
    const response = await getNoteImageRoute(request, {
      params: Promise.resolve({ id: String(hen.id), imageId: String(img.id) }),
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as NoteImage;
    expect(data.status).toBe("succeeded");
    expect(data.ai_suggestion).toBe("A hen sitting on eggs");
  }, 15000);
});

describe("PATCH retry action", () => {
  it("rejects retry on a non-failed image with 409", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("Retry NotFailed");
    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/rnf_${randomUUID()}.png`,
      original_width: 50,
      original_height: 50,
      recorded_by: ADMIN_EMAIL,
    });

    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/${img.id}`,
      { action: "retry" },
      "PATCH"
    );
    const response = await patchNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id), imageId: String(img.id) }),
    });
    expect(response.status).toBe(409);
  }, 15000);

  it("resets a failed image to pending and fires processNoteImage", async () => {
    setSession({ email: ADMIN_EMAIL, role: "Admin" });
    const hen = await ensureHen("Retry Happy");
    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/rh_${randomUUID()}.png`,
      original_width: 50,
      original_height: 50,
      recorded_by: ADMIN_EMAIL,
    });
    await updateNoteImageStatus(img.id, "failed", { ai_error: "provider down" });

    mockProcessNoteImage.mockResolvedValue(undefined);

    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/${img.id}`,
      { action: "retry" },
      "PATCH"
    );
    const response = await patchNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id), imageId: String(img.id) }),
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as NoteImage;
    expect(data.status).toBe("pending");
    expect(data.ai_error).toBeNull();

    expect(mockProcessNoteImage).toHaveBeenCalledWith(img.id, ADMIN_EMAIL);
  }, 15000);

  it("rejects a Viewer retrying another user's image with 403", async () => {
    setSession({ email: OTHER_EMAIL, role: "Viewer" });
    const hen = await ensureHen("Retry Other");
    const img = await createPendingNoteImage({
      chicken_id: hen.id,
      file_path: `notes/_pending/ro_${randomUUID()}.png`,
      original_width: 50,
      original_height: 50,
      recorded_by: ADMIN_EMAIL,
    });
    await updateNoteImageStatus(img.id, "failed", { ai_error: "oops" });

    const request = buildJsonRequest(
      `http://localhost/api/chickens/${hen.id}/notes/images/${img.id}`,
      { action: "retry" },
      "PATCH"
    );
    const response = await patchNoteImage(request, {
      params: Promise.resolve({ id: String(hen.id), imageId: String(img.id) }),
    });
    expect(response.status).toBe(403);
  }, 15000);
});
