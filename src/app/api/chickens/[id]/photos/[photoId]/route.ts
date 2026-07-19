import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getChicken } from "@/lib/chickens";
import { getPhoto, updatePhoto, deletePhoto } from "@/lib/photos";
import { deleteImageFile } from "@/lib/image-storage";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "Admin") {
      return NextResponse.json(
        { message: "Only admins can update photos" },
        { status: 403 }
      );
    }

    const { id: rawChickenId, photoId: rawPhotoId } = await params;
    const chickenId = parseInt(rawChickenId, 10);
    const photoId = parseInt(rawPhotoId, 10);
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

    const body = await request.json();
    const updated = await updatePhoto(photoId, {
      description: body.description !== undefined ? body.description : undefined,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "Admin") {
      return NextResponse.json(
        { message: "Only admins can delete photos" },
        { status: 403 }
      );
    }

    const { id: rawChickenId, photoId: rawPhotoId } = await params;
    const chickenId = parseInt(rawChickenId, 10);
    const photoId = parseInt(rawPhotoId, 10);
    if (isNaN(chickenId) || isNaN(photoId)) {
      return NextResponse.json({ message: "Invalid id" }, { status: 400 });
    }

    const photo = await getPhoto(photoId);
    if (!photo || photo.chicken_id !== chickenId) {
      return NextResponse.json({ message: "Photo not found" }, { status: 404 });
    }

    await deletePhoto(photoId);

    await deleteImageFile(photo.file_path);
    if (photo.thumbnail_path) {
      await deleteImageFile(photo.thumbnail_path);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
