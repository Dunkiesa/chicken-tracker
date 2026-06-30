import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { mergeValues, type DynamicListType } from "@/lib/dynamic-lists";

const VALID_TYPES: DynamicListType[] = ["breeds", "origin_sources", "acquisition_types"];

function normalizeType(raw: string): DynamicListType | null {
  const t = raw.replace(/-/g, "_");
  if (VALID_TYPES.includes(t as DynamicListType)) return t as DynamicListType;
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || session.user.role !== "Admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const listType = normalizeType(params.type);
    if (!listType) {
      return NextResponse.json({ message: "Invalid list type" }, { status: 400 });
    }

    const body = await request.json();
    const { sourceId, targetId } = body;

    if (!sourceId || typeof sourceId !== "number") {
      return NextResponse.json({ message: "sourceId is required" }, { status: 400 });
    }
    if (!targetId || typeof targetId !== "number") {
      return NextResponse.json({ message: "targetId is required" }, { status: 400 });
    }

    await mergeValues(listType, sourceId, targetId);
    return NextResponse.json({ message: "Merged" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message: msg }, { status: 400 });
  }
}
