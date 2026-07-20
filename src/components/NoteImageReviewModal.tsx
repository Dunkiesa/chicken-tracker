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
  Chip,
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
  cropOnly?: boolean;
};

function fromCropRegion(crop: CropRegion): CropRect {
  return {
    x: crop.x_min * 100,
    y: crop.y_min * 100,
    width: (crop.x_max - crop.x_min) * 100,
    height: (crop.y_max - crop.y_min) * 100,
  };
}

function toCropRegion(rect: CropRect): CropRegion {
  return {
    x_min: rect.x / 100,
    y_min: rect.y / 100,
    x_max: (rect.x + rect.width) / 100,
    y_max: (rect.y + rect.height) / 100,
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
  cropOnly = false,
}: NoteImageReviewModalProps) {
  const [cropRect, setCropRect] = useState<CropRect>({ x: 0, y: 0, width: 100, height: 100 });
  const [text, setText] = useState(initialText);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number } | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
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
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
    prevIsResendingRef.current = isResending;
  }, [isResending, initialText]);

  useEffect(() => {
    if (initialCrop) {
      setCropRect(fromCropRegion(initialCrop));
    } else {
      setCropRect({ x: 0, y: 0, width: 100, height: 100 });
    }
  }, [initialCrop]);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  }, []);

  const handleSave = () => {
    const crop = toCropRegion(cropRect);
    onSave(crop, text);
  };

  const handleResend = () => {
    if (!onResend) return;
    const crop = toCropRegion(cropRect);
    onResend(crop);
  };

  const getImageBounds = () => {
    if (!naturalDimensions || !containerRef.current) {
      return { left: 0, top: 0, width: 1, height: 1 };
    }
    const containerWidth = containerRef.current.offsetWidth;
    const containerHeight = containerRef.current.offsetHeight;
    const imageAspect = naturalDimensions.width / naturalDimensions.height;
    const containerAspect = containerWidth / containerHeight;

    let renderedWidth: number;
    let renderedHeight: number;
    let left: number;
    let top: number;

    if (containerAspect > imageAspect) {
      renderedHeight = containerHeight;
      renderedWidth = containerHeight * imageAspect;
      left = (containerWidth - renderedWidth) / 2;
      top = 0;
    } else {
      renderedWidth = containerWidth;
      renderedHeight = containerWidth / imageAspect;
      left = 0;
      top = (containerHeight - renderedHeight) / 2;
    }

    return { left, top, width: renderedWidth, height: renderedHeight };
  };

  const imageToContainerRect = (rect: CropRect) => {
    const bounds = getImageBounds();
    const containerWidth = bounds.left * 2 + bounds.width;
    const containerHeight = bounds.top * 2 + bounds.height;

    return {
      x: (bounds.left + (rect.x / 100) * bounds.width) / containerWidth * 100,
      y: (bounds.top + (rect.y / 100) * bounds.height) / containerHeight * 100,
      width: ((rect.width / 100) * bounds.width) / containerWidth * 100,
      height: ((rect.height / 100) * bounds.height) / containerHeight * 100,
    };
  };

  const containerToImageRect = (rect: CropRect) => {
    const bounds = getImageBounds();
    const containerWidth = bounds.left * 2 + bounds.width;
    const containerHeight = bounds.top * 2 + bounds.height;

    return {
      x: ((rect.x / 100) * containerWidth - bounds.left) / bounds.width * 100,
      y: ((rect.y / 100) * containerHeight - bounds.top) / bounds.height * 100,
      width: ((rect.width / 100) * containerWidth) / bounds.width * 100,
      height: ((rect.height / 100) * containerHeight) / bounds.height * 100,
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
    const bounds = getImageBounds();
    const containerWidth = bounds.left * 2 + bounds.width;
    const containerHeight = bounds.top * 2 + bounds.height;
    const dx = ((e.clientX - startX) / bounds.width) * 100;
    const dy = ((e.clientY - startY) / bounds.height) * 100;
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
        {cropOnly ? "Adjust Crop" : "Review Image"}
        <IconButton
          aria-label="Close"
          onClick={onCancel}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ position: "relative" }}>
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
          {naturalDimensions && (() => {
            const rect = imageToContainerRect(cropRect);
            return (
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
                  style={{ height: `${rect.y}%` }}
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
                  style={{ height: `${100 - rect.y - rect.height}%` }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    bgcolor: "rgba(0,0,0,0.5)",
                    pointerEvents: "none",
                  }}
                  style={{
                    top: `${rect.y}%`,
                    left: 0,
                    width: `${rect.x}%`,
                    height: `${rect.height}%`,
                  }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    bgcolor: "rgba(0,0,0,0.5)",
                    pointerEvents: "none",
                  }}
                  style={{
                    top: `${rect.y}%`,
                    right: 0,
                    width: `${100 - rect.x - rect.width}%`,
                    height: `${rect.height}%`,
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
                    left: `${rect.x}%`,
                    top: `${rect.y}%`,
                    width: `${rect.width}%`,
                    height: `${rect.height}%`,
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
                {isResending && (
                  <Chip
                    label="Processing..."
                    color="info"
                    size="small"
                    data-testid="processing-badge"
                    icon={<CircularProgress size={14} color="inherit" />}
                    sx={{
                      position: "absolute",
                      zIndex: 10,
                      fontWeight: 600,
                      pointerEvents: "none",
                    }}
                    style={{
                      left: `${rect.x + rect.width / 2}%`,
                      top: `${rect.y + rect.height / 2}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                )}
              </>
            );
          })()}
        </Box>
        {error && !cropOnly && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        {showSuccess && !error && !cropOnly && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Image processed successfully
          </Alert>
        )}
        {!cropOnly && (
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
        )}
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
            sx={isResending ? { opacity: 0.5 } : undefined}
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
