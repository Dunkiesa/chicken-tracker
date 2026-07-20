import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getChicken } from "@/lib/chickens";
import { createNote, listNotes } from "@/lib/notes";
import { combineNoteContent, parseAiTexts } from "@/lib/note_content";
import { processNoteImages } from "@/lib/note_image_processing";

export const dynamic = "force-dynamic";

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
    const { content, date, imageIds, crops, aiTexts } = body;

    const ids: number[] = Array.isArray(imageIds) ? imageIds : [];

    const hasContent = typeof content === "string" && content.trim().length > 0;
    const hasImages = ids.length > 0;
    if (!hasContent && !hasImages) {
      return NextResponse.json(
        { message: "content or at least one image is required" },
        { status: 400 }
      );
    }

    if (!date || typeof date !== "string") {
      return NextResponse.json(
        { message: "date is required" },
        { status: 400 }
      );
    }

    const orderedAiTexts = parseAiTexts(aiTexts, ids);
    const combinedContent = combineNoteContent((content ?? "").trim(), orderedAiTexts);

    const note = await createNote({
      chicken_id: chickenId,
      content: combinedContent,
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
