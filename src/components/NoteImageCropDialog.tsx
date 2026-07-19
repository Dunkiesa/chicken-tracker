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

type NoteImageCropDialogProps = {
  open: boolean;
  imageUrl: string;
  onCrop: (crop: Area) => void;
  onCancel: () => void;
};

export default function NoteImageCropDialog({
  open,
  imageUrl,
  onCrop,
  onCancel,
}: NoteImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleConfirm = () => {
    if (!croppedAreaPixels) return;
    onCrop(croppedAreaPixels);
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
          disabled={!croppedAreaPixels}
          aria-label="Save"
        >
          <CheckIcon />
        </Button>
      </DialogActions>
    </Dialog>
  );
}
