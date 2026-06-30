import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runMigrations } from "@/lib/db";
import {
  listValues,
  createValue,
  renameValue,
  removeValue,
  type DynamicListType,
} from "@/lib/dynamic-lists";

const VALID_TYPES: DynamicListType[] = ["breeds", "origin_sources", "acquisition_types"];

function normalizeType(raw: string): DynamicListType | null {
  const t = raw.replace(/-/g, "_");
  if (VALID_TYPES.includes(t as DynamicListType)) return t as DynamicListType;
  return null;
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || session.user.role !== "Admin") {
    return null;
  }
  return session;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    const listType = normalizeType(params.type);
    if (!listType) {
      return NextResponse.json({ message: "Invalid list type" }, { status: 400 });
    }

    await runMigrations();
    const values = await listValues(listType);
    return NextResponse.json(values);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const listType = normalizeType(params.type);
    if (!listType) {
      return NextResponse.json({ message: "Invalid list type" }, { status: 400 });
    }

    await runMigrations();
    const body = await request.json();
    const { value } = body;

    if (!value || typeof value !== "string" || value.trim().length === 0) {
      return NextResponse.json({ message: "Value is required" }, { status: 400 });
    }

    const entry = await createValue(listType, value);
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const listType = normalizeType(params.type);
    if (!listType) {
      return NextResponse.json({ message: "Invalid list type" }, { status: 400 });
    }

    const body = await request.json();
    const { id, value } = body;

    if (!id || typeof id !== "number") {
      return NextResponse.json({ message: "id is required" }, { status: 400 });
    }
    if (!value || typeof value !== "string" || value.trim().length === 0) {
      return NextResponse.json({ message: "value is required" }, { status: 400 });
    }

    await renameValue(listType, id, value);
    return NextResponse.json({ message: "Renamed" });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const listType = normalizeType(params.type);
    if (!listType) {
      return NextResponse.json({ message: "Invalid list type" }, { status: 400 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id || typeof id !== "number") {
      return NextResponse.json({ message: "id is required" }, { status: 400 });
    }

    await removeValue(listType, id);
    return NextResponse.json({ message: "Removed" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message: msg }, { status: 400 });
  }
}
