import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getImageDirectory } from "@/lib/photos";
import { readFile } from "fs/promises";
import { join, resolve } from "path";
import { shardPhotoFilename, shardFilename } from "@/lib/image-storage";

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
};

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { filename } = await params;

    // Prevent path traversal: reject filenames containing path separators or parent refs
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return NextResponse.json({ message: "Invalid filename" }, { status: 400 });
    }

    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    const imageDir = resolve(getImageDirectory());
    const photoPath = join(imageDir, shardPhotoFilename(filename));
    const legacyShardedPath = join(imageDir, shardFilename(filename));
    const legacyPath = join(imageDir, filename);

    let buffer: Buffer;
    try {
      buffer = await readFile(photoPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        try {
          buffer = await readFile(legacyShardedPath);
        } catch (err2) {
          if ((err2 as NodeJS.ErrnoException).code === "ENOENT") {
            buffer = await readFile(legacyPath);
          } else {
            throw err2;
          }
        }
      } else {
        throw err;
      }
    }

    const ab = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(ab).set(buffer);

    return new NextResponse(ab, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
