"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Button,
  Stack,
  Alert,
  IconButton,
  CircularProgress,
  Chip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckIcon from "@mui/icons-material/Check";
import RefreshIcon from "@mui/icons-material/Refresh";
import NoteImageCropDialog from "@/components/NoteImageCropDialog";
import NoteImageReviewModal from "@/components/NoteImageReviewModal";
import { useNoteImageSSE } from "@/hooks/useNoteImageSSE";
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
  status: "pending" | "processing" | "succeeded" | "failed" | "skipped";
  ai_suggestion?: string | null;
  ai_error?: string | null;
};

type NoteImageManagerProps = {
  chickenId: number;
  images: NoteImageEntry[];
  onChange: (images: NoteImageEntry[]) => void;
  disabled?: boolean;
  onAISuggestion?: (imageId: number, text: string, bbox: [number, number, number, number] | null) => void;
};

function areaToCropRegion(area: Area): CropRegion {
  return {
    x_min: area.x / 100,
    y_min: area.y / 100,
    x_max: (area.x + area.width) / 100,
    y_max: (area.y + area.height) / 100,
  };
}

export function noteImageUrl(filePath: string) {
  const filename = filePath.split("/").pop() ?? filePath;
  return `/api/notes/images/${filename}`;
}

const overlayIconButtonSx = {
  bgcolor: "rgba(0,0,0,0.5)",
  color: "white",
  width: 28,
  height: 28,
  "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
} as const;

const statusBadgeConfig: Record<string, { label: string; color: "warning" | "info" | "success" | "error" | "default" }> = {
  pending: { label: "Pending", color: "default" },
  processing: { label: "Processing...", color: "info" },
  succeeded: { label: "AI suggested", color: "success" },
  failed: { label: "Failed", color: "error" },
  skipped: { label: "Ready", color: "default" },
};

export default function NoteImageManager({
  chickenId,
  images,
  onChange,
  disabled,
  onAISuggestion,
}: NoteImageManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<NoteImageEntry | null>(null);
  const [reviewImage, setReviewImage] = useState<NoteImageEntry | null>(null);
  const [resendingImageId, setResendingImageId] = useState<number | null>(null);
  const fileInputKeyRef = useRef(0);
  const prevStatusesRef = useRef<Record<number, { status: string; text?: string }>>({});
  const prevResendingSSEStatusRef = useRef<string | null>(null);

  const trackedIds = useMemo(() => images.map((i) => i.id), [images]);
  const { statuses, retryImage, resendImage } = useNoteImageSSE(chickenId, trackedIds);

  const onAISuggestionRef = useRef(onAISuggestion);
  onAISuggestionRef.current = onAISuggestion;

  useEffect(() => {
    const prev = prevStatusesRef.current;
    let changed = false;
    const next = { ...prev };

    const updatedImages = images.map((img) => {
      const sse = statuses[img.id];
      if (!sse) return img;

      const prevEntry = prev[img.id];
      if (prevEntry && prevEntry.status === sse.status && prevEntry.text === sse.text) return img;

      changed = true;
      next[img.id] = { status: sse.status, text: sse.text };

      return {
        ...img,
        status: sse.status,
        ai_suggestion: sse.text ?? img.ai_suggestion,
        ai_error: sse.error ?? img.ai_error,
      };
    });

    if (changed) {
      onChange(updatedImages);
      if (reviewImage) {
        const updatedReviewImage = updatedImages.find((i) => i.id === reviewImage.id);
        if (updatedReviewImage) {
          setReviewImage(updatedReviewImage);
        }
      }
      for (const img of updatedImages) {
        const sse = statuses[img.id];
        if (sse && sse.status === "succeeded" && sse.text) {
          const prevEntry = prev[img.id];
          if (!prevEntry || prevEntry.status !== "succeeded") {
            onAISuggestionRef.current?.(img.id, sse.text, sse.bbox ?? null);
          }
        }
      }
    }

    prevStatusesRef.current = next;
  }, [statuses, images, onChange, reviewImage]);

  useEffect(() => {
    if (resendingImageId === null) {
      prevResendingSSEStatusRef.current = null;
      return;
    }
    const sse = statuses[resendingImageId];
    if (!sse) return;
    const prevStatus = prevResendingSSEStatusRef.current;
    prevResendingSSEStatusRef.current = sse.status;
    if (
      (prevStatus === "processing" || prevStatus === "pending") &&
      sse.status !== "processing" &&
      sse.status !== "pending"
    ) {
      setResendingImageId(null);
    }
  }, [statuses, resendingImageId]);

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
        { id: image.id, file_path: image.file_path, crop: null, status: "pending" as const },
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

  const handleThumbnailClick = (image: NoteImageEntry) => {
    if (image.status === "pending" || image.status === "processing") return;
    if (image.status === "skipped") {
      setCropImage(image);
    } else if (image.status === "succeeded" || image.status === "failed") {
      setReviewImage(image);
    }
  };

  const handleReviewSave = (crop: CropRegion, text: string) => {
    if (!reviewImage) return;
    onChange(
      images.map((i) =>
        i.id === reviewImage.id ? { ...i, crop, ai_suggestion: text, ai_error: null } : i
      )
    );
    setReviewImage(null);
  };

  const handleReviewCancel = () => {
    setReviewImage(null);
  };

  const handleReviewResend = useCallback(async (crop: CropRegion) => {
    if (!reviewImage) return;
    setResendingImageId(reviewImage.id);
    const result = await resendImage(reviewImage.id, crop);
    if (!result) {
      setResendingImageId(null);
    }
  }, [reviewImage, resendImage]);

  const handleRetry = useCallback(async (imageId: number) => {
    await retryImage(imageId);
  }, [retryImage]);

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
            {images.map((image) => {
              const badge = statusBadgeConfig[image.status] ?? statusBadgeConfig["pending"]!;
              const isProcessing = image.status === "pending" || image.status === "processing";
              return (
                <Box
                  key={image.id}
                  sx={{ position: "relative", width: 80, height: 80 }}
                >
                  <Box
                    component="img"
                    src={noteImageUrl(image.file_path)}
                    alt={`Note image ${image.id}`}
                    onClick={() => handleThumbnailClick(image)}
                    sx={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: 1,
                      border: 1,
                      borderColor: image.status === "failed" ? "error.main" : "divider",
                      cursor: isProcessing ? "default" : "pointer",
                      pointerEvents: isProcessing ? "none" : "auto",
                    }}
                  />
                  <Chip
                    label={badge.label}
                    size="small"
                    color={badge.color}
                    data-testid={`status-badge-${image.id}`}
                    sx={{
                      position: "absolute",
                      bottom: -8,
                      left: "50%",
                      transform: "translateX(-50%)",
                      height: 18,
                      fontSize: "0.6rem",
                      zIndex: 1,
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
                    sx={{ position: "absolute", bottom: 14, right: 2 }}
                  >
                    {image.status === "failed" && (
                      <IconButton
                        size="small"
                        onClick={() => handleRetry(image.id)}
                        aria-label="Retry AI"
                        sx={overlayIconButtonSx}
                      >
                        <RefreshIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    )}
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
              );
            })}
          </Stack>
        )}
      </Stack>

      {cropImage && (
        <NoteImageCropDialog
          open={true}
          imageUrl={noteImageUrl(cropImage.file_path)}
          onCrop={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}

      {reviewImage && (
        <NoteImageReviewModal
          open={true}
          imageUrl={noteImageUrl(reviewImage.file_path)}
          initialCrop={reviewImage.crop}
          initialText={reviewImage.ai_suggestion ?? ""}
          onSave={handleReviewSave}
          onCancel={handleReviewCancel}
          onResend={handleReviewResend}
          isResending={resendingImageId === reviewImage.id}
          error={reviewImage.ai_error}
        />
      )}
    </>
  );
}
