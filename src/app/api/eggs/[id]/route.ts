import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEgg, updateEgg, deleteEgg, checkDuplicate } from "@/lib/eggs";

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
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ message: "Invalid id" }, { status: 400 });
    }

    const egg = await getEgg(id);
    if (!egg) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    return NextResponse.json(egg);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ message: "Invalid id" }, { status: 400 });
    }

    const egg = await getEgg(id);
    if (!egg) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    const isAdmin = session.user.role === "Admin";
    const isOwner = egg.recorded_by === session.user.email;
    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { message: "You can only edit your own egg entries" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { chicken_id, weight, date } = body;
    const updateInput: {
      chicken_id?: number;
      weight?: number;
      date?: string;
    } = {};

    if (chicken_id !== undefined) updateInput.chicken_id = chicken_id;
    if (weight !== undefined) {
      updateInput.weight = Math.round(weight * 100) / 100;
    }
    if (date !== undefined) updateInput.date = date;

    if (updateInput.chicken_id || updateInput.date) {
      const targetChickenId = updateInput.chicken_id ?? egg.chicken_id;
      const targetDate = updateInput.date ?? egg.date;
      const existingId = await checkDuplicate(targetChickenId, targetDate, id);
      if (existingId) {
        return NextResponse.json(
          {
            message: "An egg for this chicken already exists on this date",
            code: "DUPLICATE_DATE",
            existing_egg_id: existingId,
          },
          { status: 409 }
        );
      }
    }

    const updated = await updateEgg(id, updateInput);
    if (!updated) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ message: "Invalid id" }, { status: 400 });
    }

    const egg = await getEgg(id);
    if (!egg) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    const isAdmin = session.user.role === "Admin";
    const isOwner = egg.recorded_by === session.user.email;
    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { message: "You can only delete your own egg entries" },
        { status: 403 }
      );
    }

    await deleteEgg(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
