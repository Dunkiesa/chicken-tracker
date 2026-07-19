import { resolve, join } from "path";
import { writeFile, mkdir, rm } from "fs/promises";

const SHARD_RE = /^[a-f0-9]{2}$/;

function needsSharding(filePath: string): boolean {
  if (!filePath) return false;
  const parts = filePath.split("/");
  if (parts.length === 1) return true;
  if (filePath.startsWith("notes/_pending/")) return false;
  if (parts.length === 3 && parts[0] === "photos" && SHARD_RE.test(parts[1]!)) return false;
  if (parts.length === 3 && parts[0] === "notes" && SHARD_RE.test(parts[1]!)) return false;
  return true;
}

function shardFilename(filename: string): string {
  const shard = filename.slice(0, 2).toLowerCase();
  return `${shard}/${filename}`;
}

describe("migrate-sharded-images", () => {
  describe("needsSharding", () => {
    it("returns false for empty/null paths", () => {
      expect(needsSharding("")).toBe(false);
    });

    it("returns true for unsharded filenames (no directory)", () => {
      expect(needsSharding("abc123.jpg")).toBe(true);
      expect(needsSharding("photo.png")).toBe(true);
      expect(needsSharding("thumb.webp")).toBe(true);
    });

    it("returns false for pending note images", () => {
      expect(needsSharding("notes/_pending/abc.jpg")).toBe(false);
      expect(needsSharding("notes/_pending/abc_thumb.webp")).toBe(false);
    });

    it("returns false for already-sharded photo paths", () => {
      expect(needsSharding("photos/ab/abc123.jpg")).toBe(false);
      expect(needsSharding("photos/ff/photo.png")).toBe(false);
      expect(needsSharding("photos/00/thumb.webp")).toBe(false);
    });

    it("returns false for already-sharded note image paths", () => {
      expect(needsSharding("notes/ab/abc123.jpg")).toBe(false);
      expect(needsSharding("notes/ff/photo.png")).toBe(false);
      expect(needsSharding("notes/00/thumb.webp")).toBe(false);
    });

    it("returns false for already-sharded photo thumbnail paths", () => {
      expect(needsSharding("photos/ab/ab_thumb_xyz.webp")).toBe(false);
      expect(needsSharding("photos/ff/ff_thumb_123.webp")).toBe(false);
    });

    it("returns false for already-sharded note image thumbnail paths", () => {
      expect(needsSharding("notes/ab/ab_thumb_xyz.webp")).toBe(false);
      expect(needsSharding("notes/ff/ff_thumb_123.webp")).toBe(false);
    });

    it("returns true for paths with wrong structure", () => {
      expect(needsSharding("photos/abc.jpg")).toBe(true);
      expect(needsSharding("notes/abc.jpg")).toBe(true);
      expect(needsSharding("photos/abc/def/ghi.jpg")).toBe(true);
      expect(needsSharding("other/ab/file.jpg")).toBe(true);
    });

    it("returns true for paths with invalid shard pattern", () => {
      expect(needsSharding("photos/zz/file.jpg")).toBe(true);
      expect(needsSharding("notes/ZZ/file.jpg")).toBe(true);
      expect(needsSharding("photos/g1/file.jpg")).toBe(true);
    });
  });

  describe("shardFilename", () => {
    it("extracts first 2 chars as shard", () => {
      expect(shardFilename("abc123.jpg")).toBe("ab/abc123.jpg");
      expect(shardFilename("FF456.png")).toBe("ff/FF456.png");
      expect(shardFilename("00thumb.webp")).toBe("00/00thumb.webp");
    });
  });

  describe("migration scenarios", () => {
    it("correctly identifies photo with unsharded file and thumbnail", () => {
      const filePath = "abc123.jpg";
      const thumbnailPath = "abc123_thumb.webp";
      
      expect(needsSharding(filePath)).toBe(true);
      expect(needsSharding(thumbnailPath)).toBe(true);
      
      const newFilePath = `photos/${shardFilename(filePath)}`;
      const newThumbPath = `photos/${shardFilename(thumbnailPath)}`;
      
      expect(newFilePath).toBe("photos/ab/abc123.jpg");
      expect(newThumbPath).toBe("photos/ab/abc123_thumb.webp");
    });

    it("correctly identifies photo with sharded file but unsharded thumbnail", () => {
      const filePath = "photos/ab/abc123.jpg";
      const thumbnailPath = "abc123_thumb.webp";
      
      expect(needsSharding(filePath)).toBe(false);
      expect(needsSharding(thumbnailPath)).toBe(true);
      
      const newThumbPath = `photos/${shardFilename(thumbnailPath)}`;
      expect(newThumbPath).toBe("photos/ab/abc123_thumb.webp");
    });

    it("correctly identifies photo with both sharded", () => {
      const filePath = "photos/ab/abc123.jpg";
      const thumbnailPath = "photos/ab/abc123_thumb.webp";
      
      expect(needsSharding(filePath)).toBe(false);
      expect(needsSharding(thumbnailPath)).toBe(false);
    });

    it("correctly identifies note image with unsharded file and thumbnail", () => {
      const filePath = "ab789.jpg";
      const thumbnailPath = "ab789_thumb.webp";
      
      expect(needsSharding(filePath)).toBe(true);
      expect(needsSharding(thumbnailPath)).toBe(true);
      
      const newFilePath = `notes/${shardFilename(filePath)}`;
      const newThumbPath = `notes/${shardFilename(thumbnailPath)}`;
      
      expect(newFilePath).toBe("notes/ab/ab789.jpg");
      expect(newThumbPath).toBe("notes/ab/ab789_thumb.webp");
    });

    it("correctly identifies note image with sharded file but unsharded thumbnail", () => {
      const filePath = "notes/ab/ab789.jpg";
      const thumbnailPath = "ab789_thumb.webp";
      
      expect(needsSharding(filePath)).toBe(false);
      expect(needsSharding(thumbnailPath)).toBe(true);
      
      const newThumbPath = `notes/${shardFilename(thumbnailPath)}`;
      expect(newThumbPath).toBe("notes/ab/ab789_thumb.webp");
    });

    it("correctly identifies note image with both sharded", () => {
      const filePath = "notes/ab/ab789.jpg";
      const thumbnailPath = "notes/ab/ab789_thumb.webp";
      
      expect(needsSharding(filePath)).toBe(false);
      expect(needsSharding(thumbnailPath)).toBe(false);
    });

    it("correctly skips pending note images", () => {
      const filePath = "notes/_pending/abc.jpg";
      const thumbnailPath = "notes/_pending/abc_thumb.webp";
      
      expect(needsSharding(filePath)).toBe(false);
      expect(needsSharding(thumbnailPath)).toBe(false);
    });
  });
});
