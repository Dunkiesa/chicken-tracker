import { ensureDatabase, runMigrations } from "@/lib/db";
import { createChicken, listChickens, type Chicken } from "@/lib/chickens";
import {
  createPhoto,
  listPhotos,
  getPhoto,
  updatePhoto,
  deletePhoto,
  setPrimaryPhoto,
  type Photo,
} from "@/lib/photos";

beforeAll(async () => {
  await ensureDatabase();
  await runMigrations();
}, 30000);

const RECORDED_BY = "test-photos@example.com";

async function ensureHen(name: string): Promise<Chicken> {
  const all = await listChickens();
  const existing = all.find((c: Chicken) => c.name === name);
  if (existing) return existing;
  return createChicken({ name, sex: "Hen" });
}

describe("Photo CRUD", () => {
  it("creates a photo record with a file path and description", async () => {
    const hen = await ensureHen("Photo Create Test");
    const photo = await createPhoto({
      chicken_id: hen.id,
      file_path: "test-photo-123.jpg",
      description: "A test photo of the hen",
      recorded_by: RECORDED_BY,
    });

    expect(photo).toBeDefined();
    expect(photo.chicken_id).toBe(hen.id);
    expect(photo.file_path).toBe("test-photo-123.jpg");
    expect(photo.description).toBe("A test photo of the hen");
    expect(photo.recorded_by).toBe(RECORDED_BY);
    expect(typeof photo.id).toBe("number");
  }, 15000);

  it("retrieves a photo by ID", async () => {
    const hen = await ensureHen("Photo Get Test");
    const photo = await createPhoto({
      chicken_id: hen.id,
      file_path: "test-photo-get.jpg",
      description: "Get test",
      recorded_by: RECORDED_BY,
    });

    const fetched = await getPhoto(photo.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(photo.id);
    expect(fetched!.file_path).toBe("test-photo-get.jpg");
  }, 15000);

  it("lists photos for a chicken in chronological order", async () => {
    const hen = await ensureHen("Photo List Test");
    const first = await createPhoto({
      chicken_id: hen.id,
      file_path: "first.jpg",
      description: "First photo",
      recorded_by: RECORDED_BY,
    });
    const second = await createPhoto({
      chicken_id: hen.id,
      file_path: "second.jpg",
      description: "Second photo",
      recorded_by: RECORDED_BY,
    });

    const photos = await listPhotos(hen.id);
    expect(photos.length).toBeGreaterThanOrEqual(2);
    const henPhotos = photos.filter((p: Photo) => p.chicken_id === hen.id);
    expect(henPhotos.length).toBeGreaterThanOrEqual(2);

    const firstIndex = henPhotos.findIndex((p) => p.id === first.id);
    const secondIndex = henPhotos.findIndex((p) => p.id === second.id);
    expect(firstIndex).toBeLessThan(secondIndex);
  }, 15000);

  it("returns only photos for the specified chicken", async () => {
    const henA = await ensureHen("Photo Isolation A");
    const henB = await ensureHen("Photo Isolation B");

    await createPhoto({
      chicken_id: henA.id,
      file_path: "for-a.jpg",
      description: "Photo for A",
      recorded_by: RECORDED_BY,
    });

    const bPhotos = await listPhotos(henB.id);
    expect(bPhotos.some((p: Photo) => p.description === "Photo for A")).toBe(
      false
    );
  }, 15000);

  it("updates a photo's description", async () => {
    const hen = await ensureHen("Photo Update Test");
    const photo = await createPhoto({
      chicken_id: hen.id,
      file_path: "update-test.jpg",
      description: "Original description",
      recorded_by: RECORDED_BY,
    });

    const updated = await updatePhoto(photo.id, {
      description: "Updated description",
    });
    expect(updated).not.toBeNull();
    expect(updated!.description).toBe("Updated description");
  }, 15000);

  it("deletes a photo record", async () => {
    const hen = await ensureHen("Photo Delete Test");
    const photo = await createPhoto({
      chicken_id: hen.id,
      file_path: "to-delete.jpg",
      description: "To be deleted",
      recorded_by: RECORDED_BY,
    });

    const deleted = await deletePhoto(photo.id);
    expect(deleted).toBe(true);

    const fetched = await getPhoto(photo.id);
    expect(fetched).toBeNull();
  }, 15000);

  it("returns null for a non-existent photo", async () => {
    const fetched = await getPhoto(999999);
    expect(fetched).toBeNull();
  }, 15000);
});

describe("Primary photo", () => {
  it("sets a photo as the chicken's primary photo", async () => {
    const hen = await ensureHen("Primary Photo Test");
    const photo = await createPhoto({
      chicken_id: hen.id,
      file_path: "primary-test.jpg",
      description: "Primary candidate",
      recorded_by: RECORDED_BY,
    });

    await setPrimaryPhoto(hen.id, photo.id);

    const updated = (await listChickens()).find(
      (c: Chicken) => c.id === hen.id
    );
    expect(updated).toBeDefined();
    expect(updated!.primary_photo_id).toBe(photo.id);
  }, 15000);

  it("clears a chicken's primary photo", async () => {
    const hen = await ensureHen("Primary Clear Test");
    const photo = await createPhoto({
      chicken_id: hen.id,
      file_path: "clear-test.jpg",
      description: "To be cleared",
      recorded_by: RECORDED_BY,
    });

    await setPrimaryPhoto(hen.id, photo.id);
    await setPrimaryPhoto(hen.id, null);

    const updated = (await listChickens()).find(
      (c: Chicken) => c.id === hen.id
    );
    expect(updated!.primary_photo_id).toBeNull();
  }, 15000);
});
