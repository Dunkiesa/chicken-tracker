import { NextResponse } from "next/server";
import {
  finalizeNoteImageForSave,
  discardUnreferencedPendingImages,
  discardNoteImage,
  getNoteImage,
  listNoteImagesByNote,
  recropSavedNoteImage,
  NoteImageNotPendingError,
  type CropRegion,
} from "@/lib/note_images";

export async function processNoteImages(
  chickenId: number,
  noteId: number,
  userEmail: string,
  isAdmin: boolean,
  imageIds: unknown,
  crops: unknown
): Promise<NextResponse | null> {
  const ids: number[] = Array.isArray(imageIds) ? imageIds : [];
  const cropMap: Record<string, CropRegion> =
    crops && typeof crops === "object" ? (crops as Record<string, CropRegion>) : {};

  try {
    for (const imageId of ids) {
      const img = await getNoteImage(imageId);
      if (!img || img.chicken_id !== chickenId) {
        return NextResponse.json(
          { message: `Image ${imageId} not found` },
          { status: 404 }
        );
      }
      if (!isAdmin && img.recorded_by !== userEmail) {
        return NextResponse.json(
          { message: "You can only attach your own images" },
          { status: 403 }
        );
      }
      if (img.note_id === noteId) {
        const cropOverride = cropMap[String(imageId)] ?? null;
        if (cropOverride) {
          await recropSavedNoteImage(imageId, cropOverride);
        }
        continue;
      }
      if (img.note_id !== null) {
        throw new NoteImageNotPendingError(imageId);
      }
      const cropOverride = cropMap[String(imageId)] ?? null;
      await finalizeNoteImageForSave(imageId, noteId, cropOverride);
    }

    const existingImages = await listNoteImagesByNote(noteId);
    const idSet = new Set(ids);
    for (const existing of existingImages) {
      if (!idSet.has(existing.id)) {
        await discardNoteImage(existing.id);
      }
    }

    await discardUnreferencedPendingImages(chickenId, ids);
  } catch (err: unknown) {
    if (err instanceof NoteImageNotPendingError) {
      return NextResponse.json(
        { message: err.message },
        { status: 409 }
      );
    }
    throw err;
  }

  return null;
}
