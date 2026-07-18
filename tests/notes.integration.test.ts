import { ensureDatabase, runMigrations, closePool } from "@/lib/db";
import { createChicken, type Chicken } from "@/lib/chickens";
import {
  createNote,
  listNotes,
  getNote,
  updateNote,
  deleteNote,
  type Note,
} from "@/lib/notes";

beforeAll(async () => {
  await ensureDatabase();
  await runMigrations();
}, 30000);

const RECORDED_BY = "test-notes@example.com";

async function ensureHen(name: string): Promise<Chicken> {
  const { listChickens } = await import("@/lib/chickens");
  const all = await listChickens();
  const existing = all.find((c: Chicken) => c.name === name);
  if (existing) return existing;
  return createChicken({ name, sex: "Hen" });
}

afterAll(async () => {
  await closePool();
});

describe("Note CRUD", () => {
  it("creates a note and assigns a unique ID", async () => {
    const hen = await ensureHen("Note Create Test");
    const note = await createNote({
      chicken_id: hen.id,
      content: "Vet visit - annual checkup",
      date: "2026-06-15",
      recorded_by: RECORDED_BY,
    });

    expect(note).toBeDefined();
    expect(note.chicken_id).toBe(hen.id);
    expect(note.chicken_name).toBe("Note Create Test");
    expect(note.content).toBe("Vet visit - annual checkup");
    expect(note.date).toBe("2026-06-15");
    expect(note.recorded_by).toBe(RECORDED_BY);
    expect(typeof note.id).toBe("number");
  }, 15000);

  it("retrieves a note by ID", async () => {
    const hen = await ensureHen("Note Get Test");
    const note = await createNote({
      chicken_id: hen.id,
      content: "Started new feed",
      date: "2026-06-16",
      recorded_by: RECORDED_BY,
    });

    const fetched = await getNote(note.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(note.id);
    expect(fetched!.content).toBe("Started new feed");
  }, 15000);

  it("lists notes for a chicken in reverse chronological order", async () => {
    const hen = await ensureHen("Note List Test");
    await createNote({
      chicken_id: hen.id,
      content: "First note",
      date: "2026-06-10",
      recorded_by: RECORDED_BY,
    });
    await createNote({
      chicken_id: hen.id,
      content: "Second note",
      date: "2026-06-20",
      recorded_by: RECORDED_BY,
    });

    const notes = await listNotes(hen.id);
    expect(notes.length).toBeGreaterThanOrEqual(2);
    const henNotes = notes.filter((n: Note) => n.chicken_id === hen.id);
    expect(henNotes.length).toBeGreaterThanOrEqual(2);

    for (let i = 1; i < henNotes.length; i++) {
      expect(henNotes[i - 1]!.date >= henNotes[i]!.date).toBe(true);
    }
  }, 15000);

  it("returns only notes for the specified chicken", async () => {
    const henA = await ensureHen("Note Isolation A");
    const henB = await ensureHen("Note Isolation B");

    await createNote({
      chicken_id: henA.id,
      content: "Note for A",
      date: "2026-06-25",
      recorded_by: RECORDED_BY,
    });

    const bNotes = await listNotes(henB.id);
    expect(bNotes.some((n: Note) => n.content === "Note for A")).toBe(false);
  }, 15000);

  it("updates a note's content and date", async () => {
    const hen = await ensureHen("Note Update Test");
    const note = await createNote({
      chicken_id: hen.id,
      content: "Original content",
      date: "2026-06-01",
      recorded_by: RECORDED_BY,
    });

    const updated = await updateNote(note.id, {
      content: "Updated content",
      date: "2026-06-02",
    });
    expect(updated).not.toBeNull();
    expect(updated!.content).toBe("Updated content");
    expect(updated!.date).toBe("2026-06-02");
  }, 15000);

  it("deletes a note", async () => {
    const hen = await ensureHen("Note Delete Test");
    const note = await createNote({
      chicken_id: hen.id,
      content: "To be deleted",
      date: "2026-06-03",
      recorded_by: RECORDED_BY,
    });

    const deleted = await deleteNote(note.id);
    expect(deleted).toBe(true);

    const fetched = await getNote(note.id);
    expect(fetched).toBeNull();
  }, 15000);

  it("returns null for a non-existent note", async () => {
    const fetched = await getNote(999999);
    expect(fetched).toBeNull();
  }, 15000);
});

describe("Note attribution", () => {
  it("always attributes a note to exactly one chicken", async () => {
    const hen = await ensureHen("Note Attribution Hen");

    const note = await createNote({
      chicken_id: hen.id,
      content: "Attribution check",
      date: "2026-06-10",
      recorded_by: RECORDED_BY,
    });

    expect(note.chicken_id).toBe(hen.id);
    expect(note.chicken_name).toBe("Note Attribution Hen");

    const fetched = await getNote(note.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.chicken_id).toBe(hen.id);
  }, 15000);
});
