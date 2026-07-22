import sharp from "sharp";
import { readExifDateTimeOriginal } from "@/lib/image-storage";

describe("readExifDateTimeOriginal", () => {
  it("returns null for images without EXIF data", async () => {
    const buffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await readExifDateTimeOriginal(buffer);
    expect(result).toBeNull();
  });

  it("returns null for PNG images", async () => {
    const buffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 0, g: 255, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const result = await readExifDateTimeOriginal(buffer);
    expect(result).toBeNull();
  });

  it("returns null for empty buffer", async () => {
    const result = await readExifDateTimeOriginal(Buffer.alloc(0));
    expect(result).toBeNull();
  });
});
