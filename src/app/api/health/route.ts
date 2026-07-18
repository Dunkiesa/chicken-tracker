import { NextResponse } from "next/server";
import { ensureDatabase, checkConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDatabase();
    const healthy = await checkConnection();

    if (healthy) {
      return NextResponse.json({
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
