"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  IconButton,
  TextField,
  CircularProgress,
  Alert,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import RefreshIcon from "@mui/icons-material/Refresh";
import type { CropRegion } from "@/components/NoteImageManager";

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type NoteImageReviewModalProps = {
  open: boolean;
  imageUrl: string;
  initialCrop: CropRegion | null;
  initialText: string;
  onSave: (crop: CropRegion, text: string) => void;
  onCancel: () => void;
  onResend?: (crop: CropRegion) => void;
  isResending?: boolean;
  error?: string | null;
};

function fromCropRegion(crop: CropRegion, imageWidth: number, imageHeight: number): CropRect {
  return {
    x: (crop.x_min / imageWidth) * 100,
    y: (crop.y_min / imageHeight) * 100,
    width: ((crop.x_max - crop.x_min) / imageWidth) * 100,
    height: ((crop.y_max - crop.y_min) / imageHeight) * 100,
  };
}

function toCropRegion(rect: CropRect, imageWidth: number, imageHeight: number): CropRegion {
  return {
    x_min: Math.round((rect.x / 100) * imageWidth),
    y_min: Math.round((rect.y / 100) * imageHeight),
    x_max: Math.round(((rect.x + rect.width) / 100) * imageWidth),
    y_max: Math.round(((rect.y + rect.height) / 100) * imageHeight),
  };
}

export default function NoteImageReviewModal({
  open,
  imageUrl,
  initialCrop,
  initialText,
  onSave,
  onCancel,
  onResend,
  isResending = false,
  error = null,
}: NoteImageReviewModalProps) {
  const [cropRect, setCropRect] = useState<CropRect>({ x: 0, y: 0, width: 100, height: 100 });
  const [text, setText] = useState(initialText);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevIsResendingRef = useRef(isResending);
  const dragStateRef = useRef<{
    type: "move" | "resize-tl" | "resize-tr" | "resize-bl" | "resize-br";
    startX: number;
    startY: number;
    startRect: CropRect;
  } | null>(null);

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

  useEffect(() => {
    if (prevIsResendingRef.current && !isResending) {
      setText(initialText);
    }
    prevIsResendingRef.current = isResending;
  }, [isResending, initialText]);

  useEffect(() => {
    if (naturalDimensions && initialCrop) {
      setCropRect(fromCropRegion(initialCrop, naturalDimensions.width, naturalDimensions.height));
    } else if (naturalDimensions) {
      setCropRect({ x: 0, y: 0, width: 100, height: 100 });
    }
  }, [naturalDimensions, initialCrop]);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  }, []);

  const handleSave = () => {
    if (!naturalDimensions) return;
    const crop = toCropRegion(cropRect, naturalDimensions.width, naturalDimensions.height);
    onSave(crop, text);
  };

  const handleResend = () => {
    if (!naturalDimensions || !onResend) return;
    const crop = toCropRegion(cropRect, naturalDimensions.width, naturalDimensions.height);
    onResend(crop);
  };

  const getContainerDimensions = () => {
    if (!containerRef.current) return { width: 1, height: 1 };
    return {
      width: containerRef.current.offsetWidth || 1,
      height: containerRef.current.offsetHeight || 1,
    };
  };

  const handlePointerDown = (
    e: React.PointerEvent,
    type: "move" | "resize-tl" | "resize-tr" | "resize-bl" | "resize-br"
  ) => {
    if (isResending) return;
    e.preventDefault();
    e.stopPropagation();
    dragStateRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...cropRect },
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStateRef.current) return;
    e.preventDefault();
    const { type, startX, startY, startRect } = dragStateRef.current;
    const { width: containerWidth, height: containerHeight } = getContainerDimensions();
    const dx = ((e.clientX - startX) / containerWidth) * 100;
    const dy = ((e.clientY - startY) / containerHeight) * 100;
    const MIN_SIZE = 5;

    if (type === "move") {
      const newX = Math.max(0, Math.min(100 - startRect.width, startRect.x + dx));
      const newY = Math.max(0, Math.min(100 - startRect.height, startRect.y + dy));
      setCropRect({ ...startRect, x: newX, y: newY });
    } else if (type === "resize-br") {
      const newWidth = Math.max(MIN_SIZE, Math.min(100 - startRect.x, startRect.width + dx));
      const newHeight = Math.max(MIN_SIZE, Math.min(100 - startRect.y, startRect.height + dy));
      setCropRect({ ...startRect, width: newWidth, height: newHeight });
    } else if (type === "resize-tl") {
      const newX = Math.max(0, Math.min(startRect.x + startRect.width - MIN_SIZE, startRect.x + dx));
      const newY = Math.max(0, Math.min(startRect.y + startRect.height - MIN_SIZE, startRect.y + dy));
      const newWidth = startRect.width - (newX - startRect.x);
      const newHeight = startRect.height - (newY - startRect.y);
      setCropRect({ x: newX, y: newY, width: newWidth, height: newHeight });
    } else if (type === "resize-tr") {
      const newY = Math.max(0, Math.min(startRect.y + startRect.height - MIN_SIZE, startRect.y + dy));
      const newWidth = Math.max(MIN_SIZE, Math.min(100 - startRect.x, startRect.width + dx));
      const newHeight = startRect.height - (newY - startRect.y);
      setCropRect({ ...startRect, y: newY, width: newWidth, height: newHeight });
    } else if (type === "resize-bl") {
      const newX = Math.max(0, Math.min(startRect.x + startRect.width - MIN_SIZE, startRect.x + dx));
      const newWidth = startRect.width - (newX - startRect.x);
      const newHeight = Math.max(MIN_SIZE, Math.min(100 - startRect.y, startRect.height + dy));
      setCropRect({ ...startRect, x: newX, width: newWidth, height: newHeight });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragStateRef.current) return;
    dragStateRef.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        Review Image
        <IconButton
          aria-label="Close"
          onClick={onCancel}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box
          ref={containerRef}
          sx={{
            position: "relative",
            width: "100%",
            maxHeight: "60vh",
            bgcolor: "grey.900",
            borderRadius: 1,
            overflow: "hidden",
            mt: 1,
          }}
        >
          <Box
            component="img"
            src={imageUrl}
            alt="Note image"
            onLoad={handleImageLoad}
            sx={{
              width: "100%",
              display: "block",
              maxHeight: "60vh",
              objectFit: "contain",
            }}
          />
          {naturalDimensions && (
            <>
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bgcolor: "rgba(0,0,0,0.5)",
                  pointerEvents: "none",
                }}
                style={{ height: `${cropRect.y}%` }}
              />
              <Box
                sx={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  bgcolor: "rgba(0,0,0,0.5)",
                  pointerEvents: "none",
                }}
                style={{ height: `${100 - cropRect.y - cropRect.height}%` }}
              />
              <Box
                sx={{
                  position: "absolute",
                  bgcolor: "rgba(0,0,0,0.5)",
                  pointerEvents: "none",
                }}
                style={{
                  top: `${cropRect.y}%`,
                  left: 0,
                  width: `${cropRect.x}%`,
                  height: `${cropRect.height}%`,
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  bgcolor: "rgba(0,0,0,0.5)",
                  pointerEvents: "none",
                }}
                style={{
                  top: `${cropRect.y}%`,
                  right: 0,
                  width: `${100 - cropRect.x - cropRect.width}%`,
                  height: `${cropRect.height}%`,
                }}
              />
              <Box
                data-testid="crop-rectangle"
                sx={{
                  position: "absolute",
                  border: "2px solid white",
                  boxSizing: "border-box",
                  cursor: isResending ? "default" : "move",
                  pointerEvents: isResending ? "none" : "auto",
                  touchAction: "none",
                }}
                style={{
                  left: `${cropRect.x}%`,
                  top: `${cropRect.y}%`,
                  width: `${cropRect.width}%`,
                  height: `${cropRect.height}%`,
                }}
                onPointerDown={(e) => handlePointerDown(e, "move")}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                {!isResending && (
                  <>
                    <Box
                      data-testid="handle-tl"
                      sx={{
                        position: "absolute",
                        left: -6,
                        top: -6,
                        width: 12,
                        height: 12,
                        bgcolor: "white",
                        border: "1px solid black",
                        cursor: "nwse-resize",
                        touchAction: "none",
                      }}
                      onPointerDown={(e) => handlePointerDown(e, "resize-tl")}
                    />
                    <Box
                      data-testid="handle-tr"
                      sx={{
                        position: "absolute",
                        right: -6,
                        top: -6,
                        width: 12,
                        height: 12,
                        bgcolor: "white",
                        border: "1px solid black",
                        cursor: "nesw-resize",
                        touchAction: "none",
                      }}
                      onPointerDown={(e) => handlePointerDown(e, "resize-tr")}
                    />
                    <Box
                      data-testid="handle-bl"
                      sx={{
                        position: "absolute",
                        left: -6,
                        bottom: -6,
                        width: 12,
                        height: 12,
                        bgcolor: "white",
                        border: "1px solid black",
                        cursor: "nesw-resize",
                        touchAction: "none",
                      }}
                      onPointerDown={(e) => handlePointerDown(e, "resize-bl")}
                    />
                    <Box
                      data-testid="handle-br"
                      sx={{
                        position: "absolute",
                        right: -6,
                        bottom: -6,
                        width: 12,
                        height: 12,
                        bgcolor: "white",
                        border: "1px solid black",
                        cursor: "nwse-resize",
                        touchAction: "none",
                      }}
                      onPointerDown={(e) => handlePointerDown(e, "resize-br")}
                    />
                  </>
                )}
              </Box>
            </>
          )}
        </Box>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          fullWidth
          multiline
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isResending}
          placeholder="AI suggested text"
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} aria-label="Cancel" disabled={isResending}>
          <CloseIcon />
        </Button>
        {onResend && (
          <Button
            onClick={handleResend}
            aria-label="Resend"
            disabled={isResending || !naturalDimensions}
            startIcon={isResending ? <CircularProgress size={20} /> : <RefreshIcon />}
          >
            Resend
          </Button>
        )}
        <Button
          onClick={handleSave}
          variant="contained"
          aria-label="Save"
          disabled={isResending || !naturalDimensions}
        >
          <CheckIcon />
        </Button>
      </DialogActions>
    </Dialog>
  );
}
