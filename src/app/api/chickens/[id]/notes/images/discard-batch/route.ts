import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { discardNoteImage, getNoteImage } from "@/lib/note_images";

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

    const body = (await request.json()) as { imageIds?: unknown };
    if (!body || !Array.isArray(body.imageIds)) {
      return NextResponse.json(
        { message: "imageIds must be an array of numbers" },
        { status: 400 }
      );
    }

    const imageIds: number[] = [];
    for (const id of body.imageIds) {
      if (typeof id !== "number" || !Number.isInteger(id)) {
        return NextResponse.json(
          { message: "imageIds must be an array of integers" },
          { status: 400 }
        );
      }
      imageIds.push(id);
    }

    const isAdmin = session.user.role === "Admin";
    let discarded = 0;
    let skipped = 0;
    for (const imageId of imageIds) {
      const image = await getNoteImage(imageId);
      if (!image || image.chicken_id !== chickenId) {
        skipped += 1;
        continue;
      }
      const isOwner = image.recorded_by === session.user.email;
      if (!isAdmin && !isOwner) {
        skipped += 1;
        continue;
      }
      await discardNoteImage(imageId);
      discarded += 1;
    }

    return NextResponse.json({ success: true, discarded, skipped });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
