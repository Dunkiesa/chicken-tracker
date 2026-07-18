import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getChicken } from "@/lib/chickens";
import { createPhoto, listPhotos, getImageDirectory } from "@/lib/photos";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

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

    const photos = await listPhotos(chickenId);
    return NextResponse.json(photos);
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
    if (session.user.role !== "Admin") {
      return NextResponse.json(
        { message: "Only admins can upload photos" },
        { status: 403 }
      );
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
    const file = formData.get("file") as File | null;
    const description = (formData.get("description") as string) || null;

    if (!file) {
      return NextResponse.json(
        { message: "file is required" },
        { status: 400 }
      );
    }

    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"];
    const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { message: `File type ${file.type} is not allowed. Accepted: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { message: "File size exceeds 10 MB limit" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${randomUUID()}.${ext}`;
    const imageDir = getImageDirectory();

    await mkdir(imageDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());

    // Verify file header (magic bytes) for common image formats
    const header = buffer.slice(0, 4).toString("hex");
    const VALID_HEADERS = [
      "ffd8ffe0", // JPEG
      "ffd8ffe1", // JPEG (Exif)
      "ffd8ffe2", // JPEG (ICC)
      "89504e47", // PNG
      "47494638", // GIF87a
      "47494639", // GIF89a
      "52494646", // WEBP (RIFF...WEBP)
      "424d",     // BMP
    ];
    const isImage = VALID_HEADERS.some((h) => header.startsWith(h));
    if (!isImage) {
      return NextResponse.json({ message: "File content does not match allowed image types" }, { status: 400 });
    }

    const filePath = join(imageDir, filename);
    await writeFile(filePath, buffer);

    const photo = await createPhoto({
      chicken_id: chickenId,
      file_path: filename,
      description: description ?? undefined,
      recorded_by: session.user.email,
    });

    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
