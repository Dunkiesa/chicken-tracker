import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createEgg, createEggs, listEggs, checkDuplicate, getLayingContext, getLastUsedChicken, type CreateEggInput } from "@/lib/eggs";

async function handleBatchCreate(
  items: unknown[],
  session: { user: { email: string } },
  request: NextRequest
): Promise<NextResponse> {
  try {
    if (items.length === 0) {
      return NextResponse.json(
        { message: "At least one egg entry is required" },
        { status: 400 }
      );
    }

    const inputs: CreateEggInput[] = [];
    for (const item of items) {
      const obj = item as Record<string, unknown>;
      const chicken_id = obj.chicken_id;
      const weight = obj.weight;
      const date = obj.date;

      if (typeof chicken_id !== "number" || !Number.isInteger(chicken_id) || chicken_id < 1) {
        return NextResponse.json(
          { message: "Each entry must have a valid chicken_id (positive integer)" },
          { status: 400 }
        );
      }
      if (typeof weight !== "number" || isNaN(weight) || !isFinite(weight) || weight < 0) {
        return NextResponse.json(
          { message: "Each entry must have a valid weight (non-negative number)" },
          { status: 400 }
        );
      }
      if (typeof date !== "string" || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return NextResponse.json(
          { message: "Each entry must have a valid date (YYYY-MM-DD)" },
          { status: 400 }
        );
      }

      inputs.push({
        chicken_id,
        weight: Math.round(weight * 100) / 100,
        date,
        recorded_by: session.user.email,
      });
    }

    const overrideDuplicate = request.nextUrl.searchParams.get("override_duplicate") === "true";
    const result = await createEggs(inputs, overrideDuplicate);
    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const chicken_id = searchParams.get("chicken_id")
      ? parseInt(searchParams.get("chicken_id")!, 10)
      : undefined;
    const context = searchParams.get("context") === "true";
    const lastUsed = searchParams.get("last_used") === "true";

    if (lastUsed) {
      const chicken = await getLastUsedChicken(session.user.email);
      return NextResponse.json(chicken);
    }

    if (context) {
      const layingContext = await getLayingContext();
      return NextResponse.json(layingContext);
    }

    const eggs = await listEggs(
      chicken_id || date || from || to
        ? { date, chicken_id, date_from: from, date_to: to }
        : undefined
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

    const body = await request.json();

    if (Array.isArray(body)) {
      return handleBatchCreate(body, session, request);
    }

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
