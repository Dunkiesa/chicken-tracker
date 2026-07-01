import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listUsers, addUser, removeUser, type Role } from "@/lib/users";

async function getSessionWithRole() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  if (session.user.role !== "Admin") return null;
  return session;
}

export async function GET() {
  try {
    const session = await getSessionWithRole();
    if (!session) {
      return NextResponse.json(
        { message: "Forbidden" },
        { status: 403 }
      );
    }

    const users = await listUsers();
    return NextResponse.json(users);
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
    const session = await getSessionWithRole();
    if (!session) {
      return NextResponse.json(
        { message: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email || typeof email !== "string" || email.trim().length === 0) {
      return NextResponse.json(
        { message: "Email is required" },
        { status: 400 }
      );
    }

    if (!role || !["Admin", "Viewer"].includes(role)) {
      return NextResponse.json(
        { message: "Role must be Admin or Viewer" },
        { status: 400 }
      );
    }

    await addUser(email, role as Role);
    return NextResponse.json({ message: "User added" }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";

    if (msg.includes("UNIQUE") || msg.includes("duplicate") || msg.includes("PK")) {
      return NextResponse.json(
        { message: "A user with that email already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionWithRole();
    if (!session) {
      return NextResponse.json(
        { message: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { message: "Email is required" },
        { status: 400 }
      );
    }

    await removeUser(email);
    return NextResponse.json({ message: "User removed" });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
