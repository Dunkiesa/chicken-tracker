import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getChicken } from "@/lib/chickens";
import { getPhoto, setPrimaryPhoto, setPhotoThumbnail, getImageDirectory } from "@/lib/photos";
import sharp from "sharp";
import { writeFile, mkdir, readFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

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
        { message: "Only admins can set primary photo" },
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

    let body: { crop?: { x: number; y: number; width: number; height: number } } = {};
    try {
      body = await request.json();
    } catch {
      // no body, just set primary without cropping
    }

    if (body.crop) {
      const { x, y, width, height } = body.crop;

      if (
        typeof x !== "number" || typeof y !== "number" ||
        typeof width !== "number" || typeof height !== "number" ||
        width <= 0 || height <= 0
      ) {
        return NextResponse.json(
          { message: "Invalid crop parameters" },
          { status: 400 }
        );
      }

      const imageDir = getImageDirectory();
      const sourcePath = join(imageDir, photo.file_path);

      const thumbFilename = `thumb_${randomUUID()}.webp`;
      const thumbPath = join(imageDir, thumbFilename);

      await mkdir(imageDir, { recursive: true });

      const sourceBuffer = await readFile(sourcePath);

      await sharp(sourceBuffer)
        .extract({
          left: Math.round(x),
          top: Math.round(y),
          width: Math.round(width),
          height: Math.round(height),
        })
        .resize(300, 300, { fit: "cover" })
        .webp({ quality: 85 })
        .toFile(thumbPath);

      await setPhotoThumbnail(photoId, thumbFilename);
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
