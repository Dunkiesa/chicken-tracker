import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runMigrations } from "@/lib/db";
import { getChicken } from "@/lib/chickens";
import { getPhoto, setPrimaryPhoto } from "@/lib/photos";

export async function PUT(
  _request: NextRequest,
  { params }: { params: { id: string; photoId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "Admin") {
      return NextResponse.json(
        { message: "Only admins can set primary photo" },
        { status: 403 }
      );
    }

    await runMigrations();

    const chickenId = parseInt(params.id, 10);
    const photoId = parseInt(params.photoId, 10);
    if (isNaN(chickenId) || isNaN(photoId)) {
      return NextResponse.json({ message: "Invalid id" }, { status: 400 });
    }

    const chicken = await getChicken(chickenId);
    if (!chicken) {
      return NextResponse.json({ message: "Chicken not found" }, { status: 404 });
    }

    const photo = await getPhoto(photoId);
    if (!photo || photo.chicken_id !== chickenId) {
      return NextResponse.json({ message: "Photo not found" }, { status: 404 });
    }

    await setPrimaryPhoto(chickenId, photoId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
