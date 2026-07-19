import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getChicken } from "@/lib/chickens";
import { createNote, listNotes } from "@/lib/notes";
import {
  finalizeNoteImageForSave,
  discardUnreferencedPendingImages,
  discardNoteImage,
  getNoteImage,
  listNoteImagesByNote,
  NoteImageNotPendingError,
  type CropRegion,
} from "@/lib/note_images";

export const dynamic = "force-dynamic";

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id: rawId } = await params;
    const chickenId = parseInt(rawId, 10);
    if (isNaN(chickenId)) {
      return NextResponse.json({ message: "Invalid chicken id" }, { status: 400 });
    }

    const chicken = await getChicken(chickenId);
    if (!chicken) {
      return NextResponse.json({ message: "Chicken not found" }, { status: 404 });
    }

    const notes = await listNotes(chickenId);
    return NextResponse.json(notes);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id: rawId } = await params;
    const chickenId = parseInt(rawId, 10);
    if (isNaN(chickenId)) {
      return NextResponse.json({ message: "Invalid chicken id" }, { status: 400 });
    }

    const chicken = await getChicken(chickenId);
    if (!chicken) {
      return NextResponse.json({ message: "Chicken not found" }, { status: 404 });
    }

    const body = await request.json();
    const { content, date, imageIds, crops } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { message: "content is required" },
        { status: 400 }
      );
    }

    if (!date || typeof date !== "string") {
      return NextResponse.json(
        { message: "date is required" },
        { status: 400 }
      );
    }

    const note = await createNote({
      chicken_id: chickenId,
      content: content.trim(),
      date,
      recorded_by: session.user.email,
    });

    const imgError = await processNoteImages(
      chickenId,
      note.id,
      session.user.email,
      session.user.role === "Admin",
      imageIds,
      crops
    );
    if (imgError) return imgError;

    return NextResponse.json(note, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
