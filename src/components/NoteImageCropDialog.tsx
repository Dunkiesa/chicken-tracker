"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import Cropper, { Area } from "react-easy-crop";
import type { CropRegion } from "@/components/NoteImageManager";

type NoteImageCropDialogProps = {
  open: boolean;
  imageUrl: string;
  initialCrop?: CropRegion | null;
  onCrop: (crop: Area) => void;
  onCancel: () => void;
};

function cropRegionToArea(crop: CropRegion): Area {
  return {
    x: crop.x_min * 100,
    y: crop.y_min * 100,
    width: (crop.x_max - crop.x_min) * 100,
    height: (crop.y_max - crop.y_min) * 100,
  };
}

export default function NoteImageCropDialog({
  open,
  imageUrl,
  initialCrop,
  onCrop,
  onCancel,
}: NoteImageCropDialogProps) {
  const initialArea = initialCrop ? cropRegionToArea(initialCrop) : null;
  const [crop, setCrop] = useState({ x: initialArea?.x ?? 0, y: initialArea?.y ?? 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(initialArea);

  const onCropComplete = useCallback(
    (croppedArea: Area, _croppedAreaPixels: Area) => {
      setCroppedArea(croppedArea);
    },
    []
  );

  const handleConfirm = () => {
    if (!croppedArea) return;
    onCrop(croppedArea);
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Crop Image
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
          sx={{
            position: "relative",
            width: "100%",
            height: 400,
            bgcolor: "grey.900",
            borderRadius: 1,
            overflow: "hidden",
            mt: 1,
          }}
        >
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            cropShape="rect"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} aria-label="Cancel">
          <CloseIcon />
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!croppedArea}
          aria-label="Save"
        >
          <CheckIcon />
        </Button>
      </DialogActions>
    </Dialog>
  );
}
