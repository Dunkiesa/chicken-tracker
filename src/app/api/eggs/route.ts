import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runMigrations } from "@/lib/db";
import { createEgg, listEggs, checkDuplicate, getLayingContext } from "@/lib/eggs";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await runMigrations();

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || undefined;
    const chicken_id = searchParams.get("chicken_id")
      ? parseInt(searchParams.get("chicken_id")!, 10)
      : undefined;
    const context = searchParams.get("context") === "true";

    if (context) {
      const layingContext = await getLayingContext();
      return NextResponse.json(layingContext);
    }

    const eggs = await listEggs(
      chicken_id || date ? { date, chicken_id } : undefined
    );
    return NextResponse.json(eggs);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await runMigrations();

    const body = await request.json();
    const { chicken_id, weight, date, override_duplicate } = body;

    if (!chicken_id || typeof chicken_id !== "number") {
      return NextResponse.json(
        { message: "chicken_id is required" },
        { status: 400 }
      );
    }

    if (weight === undefined || typeof weight !== "number" || isNaN(weight)) {
      return NextResponse.json(
        { message: "weight is required and must be a number" },
        { status: 400 }
      );
    }

    if (!date || typeof date !== "string") {
      return NextResponse.json(
        { message: "date is required" },
        { status: 400 }
      );
    }

    const existingId = await checkDuplicate(chicken_id, date);
    if (existingId && !override_duplicate) {
      return NextResponse.json(
        {
          message: "An egg for this chicken already exists on this date",
          code: "DUPLICATE_DATE",
          existing_egg_id: existingId,
        },
        { status: 409 }
      );
    }

    const result = await createEgg(
      {
        chicken_id,
        weight: Math.round(weight * 100) / 100,
        date,
        recorded_by: session.user.email,
      },
      !!override_duplicate
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
