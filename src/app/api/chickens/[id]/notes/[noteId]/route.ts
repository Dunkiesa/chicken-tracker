import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getNote, updateNote, deleteNote } from "@/lib/notes";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const noteId = parseInt(params.noteId, 10);
    if (isNaN(noteId)) {
      return NextResponse.json({ message: "Invalid note id" }, { status: 400 });
    }

    const note = await getNote(noteId);
    if (!note) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    return NextResponse.json(note);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const noteId = parseInt(params.noteId, 10);
    if (isNaN(noteId)) {
      return NextResponse.json({ message: "Invalid note id" }, { status: 400 });
    }

    const note = await getNote(noteId);
    if (!note) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    const isAdmin = session.user.role === "Admin";
    const isOwner = note.recorded_by === session.user.email;
    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { message: "You can only edit your own notes" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { content, date } = body;
    const updateInput: { content?: string; date?: string } = {};

    if (content !== undefined) updateInput.content = content;
    if (date !== undefined) updateInput.date = date;

    const updated = await updateNote(noteId, updateInput);
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
  { params }: { params: { id: string; noteId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const noteId = parseInt(params.noteId, 10);
    if (isNaN(noteId)) {
      return NextResponse.json({ message: "Invalid note id" }, { status: 400 });
    }

    const note = await getNote(noteId);
    if (!note) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    const isAdmin = session.user.role === "Admin";
    const isOwner = note.recorded_by === session.user.email;
    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { message: "You can only delete your own notes" },
        { status: 403 }
      );
    }

    await deleteNote(noteId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
