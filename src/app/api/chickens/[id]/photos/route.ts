import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runMigrations } from "@/lib/db";
import { getChicken } from "@/lib/chickens";
import { createPhoto, listPhotos, getImageDirectory } from "@/lib/photos";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await runMigrations();

    const chickenId = parseInt(params.id, 10);
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
  { params }: { params: { id: string } }
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

    await runMigrations();

    const chickenId = parseInt(params.id, 10);
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

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${uuidv4()}.${ext}`;
    const imageDir = getImageDirectory();

    await mkdir(imageDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
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
