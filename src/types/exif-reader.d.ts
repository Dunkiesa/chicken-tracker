declare module "exif-reader" {
  interface ExifData {
    Image?: Record<string, unknown>;
    Photo?: {
      DateTimeOriginal?: string;
      DateTimeDigitized?: string;
      DateTime?: string;
      [key: string]: unknown;
    };
    GPSInfo?: Record<string, unknown>;
    [key: string]: unknown;
  }

  function exifReader(buffer: Buffer): ExifData;
  export = exifReader;
}
