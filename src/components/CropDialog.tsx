"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Slider,
  Typography,
  Stack,
  CircularProgress,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import Cropper, { Area } from "react-easy-crop";

type CropDialogProps = {
  open: boolean;
  imageUrl: string;
  onCrop: (crop: Area) => void;
  onCancel: () => void;
  pending: boolean;
};

export default function CropDialog({
  open,
  imageUrl,
  onCrop,
  onCancel,
  pending,
}: CropDialogProps) {
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

  const handleDialogClose = () => {
    if (!pending) {
      onCancel();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Crop Thumbnail
        <IconButton
          aria-label="Close"
          onClick={onCancel}
          disabled={pending}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Box
            sx={{
              position: "relative",
              width: "100%",
              height: 400,
              bgcolor: "grey.900",
              borderRadius: 1,
              overflow: "hidden",
            }}
          >
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </Box>
          <Box sx={{ px: 1 }}>
            <Typography variant="caption" gutterBottom>
              Zoom
            </Typography>
            <Slider
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              onChange={(_e, value) => setZoom(value as number)}
              size="small"
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={pending} aria-label="Cancel">
          <CloseIcon />
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={pending || !croppedAreaPixels}
          aria-label={pending ? "Saving" : "Set as Primary"}
        >
          {pending ? <CircularProgress size={20} /> : <CheckIcon />}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
