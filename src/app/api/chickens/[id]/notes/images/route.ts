import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getChicken } from "@/lib/chickens";
import {
  NoteImageUploadError,
  createPendingNoteImageFromUpload,
  listNoteImagesByNote,
  listPendingNoteImagesByChicken,
} from "@/lib/note_images";
import { processNoteImage } from "@/lib/ai";

export const dynamic = "force-dynamic";

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

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { message: "file is required" },
        { status: 400 }
      );
    }
    const blob = file as File;

    const buffer = Buffer.from(await blob.arrayBuffer());
    const row = await createPendingNoteImageFromUpload({
      chicken_id: chickenId,
      buffer,
      original_filename: blob.name,
      mime_type: blob.type,
      recorded_by: session.user.email,
    });

    processNoteImage(row.id, session.user.email).catch((err) => {
      console.error(`[AI] processNoteImage failed for image ${row.id}:`, err);
    });

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    if (error instanceof NoteImageUploadError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(
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

    const { searchParams } = request.nextUrl;
    const noteIdRaw = searchParams.get("noteId");
    const pendingRaw = searchParams.get("pending");

    if (noteIdRaw !== null && pendingRaw !== null) {
      return NextResponse.json(
        { message: "Use either noteId or pending, not both" },
        { status: 400 }
      );
    }

    if (noteIdRaw !== null) {
      const noteId = parseInt(noteIdRaw, 10);
      if (isNaN(noteId)) {
        return NextResponse.json(
          { message: "Invalid noteId" },
          { status: 400 }
        );
      }
      const images = await listNoteImagesByNote(noteId);
      return NextResponse.json(images);
    }

    if (pendingRaw === "true") {
      const images = await listPendingNoteImagesByChicken(chickenId);
      return NextResponse.json(images);
    }

    return NextResponse.json(
      { message: "Specify either ?noteId=... or ?pending=true" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
