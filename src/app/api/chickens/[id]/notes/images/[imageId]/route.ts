import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getChicken } from "@/lib/chickens";
import {
  NoteImageNotPendingError,
  NoteImage,
  NoteImageStatus,
  CropRegion,
  discardNoteImage,
  getNoteImage,
  updateNoteImageCrop,
  updateNoteImageStatus,
} from "@/lib/note_images";
import { processNoteImage } from "@/lib/ai";

export const dynamic = "force-dynamic";

type CropBody = {
  action: "crop";
  crop: CropRegion;
};

type DiscardBody = {
  action: "discard";
};

type RetryBody = {
  action: "retry";
};

type PatchBody = CropBody | DiscardBody | RetryBody;

function isCropBody(body: unknown): body is CropBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (b.action !== "crop") return false;
  const crop = b.crop as Record<string, unknown> | undefined;
  if (!crop || typeof crop !== "object") return false;
  return (
    typeof crop.x_min === "number" &&
    typeof crop.y_min === "number" &&
    typeof crop.x_max === "number" &&
    typeof crop.y_max === "number"
  );
}

function isDiscardBody(body: unknown): body is DiscardBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return b.action === "discard";
}

function isRetryBody(body: unknown): body is RetryBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return b.action === "retry";
}

const PRE_SAVE_STATUSES: NoteImageStatus[] = ["pending", "succeeded"];

function isPreSave(image: NoteImage): boolean {
  return image.note_id === null && PRE_SAVE_STATUSES.includes(image.status);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id: rawId, imageId: rawImageId } = await params;
    const chickenId = parseInt(rawId, 10);
    const imageId = parseInt(rawImageId, 10);
    if (isNaN(chickenId) || isNaN(imageId)) {
      return NextResponse.json({ message: "Invalid id" }, { status: 400 });
    }

    const chicken = await getChicken(chickenId);
    if (!chicken) {
      return NextResponse.json({ message: "Chicken not found" }, { status: 404 });
    }

    const image = await getNoteImage(imageId);
    if (!image || image.chicken_id !== chickenId) {
      return NextResponse.json({ message: "Note image not found" }, { status: 404 });
    }

    return NextResponse.json(image);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id: rawId, imageId: rawImageId } = await params;
    const chickenId = parseInt(rawId, 10);
    const imageId = parseInt(rawImageId, 10);
    if (isNaN(chickenId) || isNaN(imageId)) {
      return NextResponse.json({ message: "Invalid id" }, { status: 400 });
    }

    const chicken = await getChicken(chickenId);
    if (!chicken) {
      return NextResponse.json({ message: "Chicken not found" }, { status: 404 });
    }

    const image = await getNoteImage(imageId);
    if (!image || image.chicken_id !== chickenId) {
      return NextResponse.json({ message: "Note image not found" }, { status: 404 });
    }

    const isAdmin = session.user.role === "Admin";
    const isOwner = image.recorded_by === session.user.email;
    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { message: "You can only modify your own note images" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as PatchBody;
    if (isDiscardBody(body)) {
      await discardNoteImage(imageId);
      return NextResponse.json({ success: true, discarded: true });
    }

    if (isRetryBody(body)) {
      if (image.status !== "failed") {
        return NextResponse.json(
          { message: "Can only retry failed images" },
          { status: 409 }
        );
      }
      await updateNoteImageStatus(imageId, "pending", {
        ai_error: null,
      });
      processNoteImage(imageId, session.user.email).catch(() => {});
      const updated = await getNoteImage(imageId);
      return NextResponse.json(updated);
    }

    if (isCropBody(body)) {
      if (!isPreSave(image)) {
        return NextResponse.json(
          { message: "Cannot adjust crop on an image already attached to a note" },
          { status: 409 }
        );
      }
      const updated = await updateNoteImageCrop(imageId, {
        crop_x_min: body.crop.x_min,
        crop_y_min: body.crop.y_min,
        crop_x_max: body.crop.x_max,
        crop_y_max: body.crop.y_max,
      });
      if (!updated) {
        return NextResponse.json({ message: "Not found" }, { status: 404 });
      }
      return NextResponse.json(updated);
    }

    return NextResponse.json(
      { message: "Invalid action; expected 'crop', 'discard', or 'retry'" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof NoteImageNotPendingError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
