import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sweepOrphanNoteImages } from "@/lib/note_images";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "Admin") {
      return NextResponse.json(
        { message: "Only admins can trigger the orphan sweep" },
        { status: 403 }
      );
    }

    let olderThanHours = 24;
    try {
      const body = (await request.json().catch(() => null)) as
        | { olderThanHours?: number }
        | null;
      if (body && typeof body.olderThanHours === "number") {
        olderThanHours = body.olderThanHours;
      }
    } catch {
      // No body is fine; defaults apply.
    }

    const reaped = await sweepOrphanNoteImages(olderThanHours);
    return NextResponse.json({ success: true, reaped });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
