import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runMigrations } from "@/lib/db";
import { createChicken, listChickens } from "@/lib/chickens";

export async function GET() {
  try {
    await runMigrations();
    const chickens = await listChickens();
    return NextResponse.json(chickens);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }
    if (session.user.role !== "Admin") {
      return NextResponse.json(
        { message: "Only admins can create chickens" },
        { status: 403 }
      );
    }

    await runMigrations();
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { message: "Name is required" },
        { status: 400 }
      );
    }

    const chicken = await createChicken(name);
    return NextResponse.json(chicken, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";

    if (msg.includes("UNIQUE") || msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json(
        { message: "A chicken with that name already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: msg },
      { status: 500 }
    );
  }
}
