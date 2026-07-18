import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NoteImageReadError, readNoteImageBytesByFilename } from "@/lib/note_images";

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
    const result = await readNoteImageBytesByFilename(filename);
    const ab = new ArrayBuffer(result.buffer.byteLength);
    new Uint8Array(ab).set(result.buffer);
    return new NextResponse(ab, {
      headers: {
        "Content-Type": result.content_type,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    if (error instanceof NoteImageReadError) {
      const status = error.code === "INVALID_PATH" ? 400 : 404;
      return NextResponse.json({ message: error.message }, { status });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
