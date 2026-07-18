"use client";

import { useState, useRef } from "react";
import {
  Box,
  Button,
  Stack,
  Alert,
  IconButton,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CropIcon from "@mui/icons-material/Crop";
import CheckIcon from "@mui/icons-material/Check";
import CropDialog from "@/components/CropDialog";
import type { Area } from "react-easy-crop";

export type CropRegion = {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
};

export type NoteImageEntry = {
  id: number;
  file_path: string;
  crop: CropRegion | null;
};

type NoteImageManagerProps = {
  chickenId: number;
  images: NoteImageEntry[];
  onChange: (images: NoteImageEntry[]) => void;
  disabled?: boolean;
};

function areaToCropRegion(area: Area): CropRegion {
  return {
    x_min: area.x,
    y_min: area.y,
    x_max: area.x + area.width,
    y_max: area.y + area.height,
  };
}

export function noteImageUrl(filePath: string) {
  return `/api/notes/images/${filePath}`;
}

const overlayIconButtonSx = {
  bgcolor: "rgba(0,0,0,0.5)",
  color: "white",
  width: 28,
  height: 28,
  "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
} as const;

export default function NoteImageManager({
  chickenId,
  images,
  onChange,
  disabled,
}: NoteImageManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<NoteImageEntry | null>(null);
  const fileInputKeyRef = useRef(0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/chickens/${chickenId}/notes/images`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.message || "Failed to upload image");
      }
      const image = await res.json();
      onChange([
        ...images,
        { id: image.id, file_path: image.file_path, crop: null },
      ]);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Failed to upload image"
      );
    } finally {
      setUploading(false);
      fileInputKeyRef.current += 1;
    }
  };

  const handleRemove = (id: number) => {
    onChange(images.filter((i) => i.id !== id));
  };

  const handleCropConfirm = (area: Area) => {
    if (!cropImage) return;
    const crop = areaToCropRegion(area);
    onChange(
      images.map((i) => (i.id === cropImage.id ? { ...i, crop } : i))
    );
    setCropImage(null);
  };

  const handleCropCancel = () => {
    setCropImage(null);
  };

  return (
    <>
      <Stack spacing={1}>
        <Button
          component="label"
          variant="outlined"
          size="small"
          disabled={disabled || uploading}
          startIcon={
            uploading ? <CircularProgress size={16} /> : <AddIcon />
          }
          aria-label="Add image"
        >
          Add image
          <input
            key={fileInputKeyRef.current}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={handleFileChange}
            disabled={disabled || uploading}
          />
        </Button>

        {uploadError && <Alert severity="error">{uploadError}</Alert>}

        {images.length > 0 && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {images.map((image) => (
              <Box
                key={image.id}
                sx={{ position: "relative", width: 80, height: 80 }}
              >
                <Box
                  component="img"
                  src={noteImageUrl(image.file_path)}
                  alt={`Note image ${image.id}`}
                  sx={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: 1,
                    border: 1,
                    borderColor: "divider",
                  }}
                />
                {image.crop && (
                  <Box
                    sx={{
                      position: "absolute",
                      top: 2,
                      left: 2,
                      bgcolor: "success.main",
                      color: "success.contrastText",
                      borderRadius: "50%",
                      width: 18,
                      height: 18,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CheckIcon sx={{ fontSize: 12 }} />
                  </Box>
                )}
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ position: "absolute", bottom: 2, right: 2 }}
                >
                  <IconButton
                    size="small"
                    onClick={() => setCropImage(image)}
                    aria-label="Crop image"
                    sx={overlayIconButtonSx}
                  >
                    <CropIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleRemove(image.id)}
                    aria-label="Remove image"
                    sx={overlayIconButtonSx}
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>

      {cropImage && (
        <CropDialog
          open={!!cropImage}
          imageUrl={noteImageUrl(cropImage.file_path)}
          onCrop={handleCropConfirm}
          onCancel={handleCropCancel}
          pending={false}
        />
      )}
    </>
  );
}
