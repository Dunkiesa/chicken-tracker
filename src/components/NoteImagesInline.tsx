"use client";

import { useState } from "react";
import {
  Box,
  Stack,
  Dialog,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import { noteImageUrl } from "@/components/NoteImageManager";
import type { CropRegion } from "@/components/NoteImageManager";

export type NoteImageForDisplay = {
  id: number;
  file_path: string;
  thumbnail_path: string | null;
  crop: CropRegion | null;
};

type NoteImagesInlineProps = {
  images: NoteImageForDisplay[];
};

function thumbUrl(image: NoteImageForDisplay) {
  return noteImageUrl(image.thumbnail_path ?? image.file_path);
}

export default function NoteImagesInline({ images }: NoteImagesInlineProps) {
  const [lightboxImage, setLightboxImage] = useState<NoteImageForDisplay | null>(null);

  if (images.length === 0) return null;

  return (
    <>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
        {images.map((image) => (
          <Box
            key={image.id}
            component="img"
            src={thumbUrl(image)}
            alt={`Note image ${image.id}`}
            onClick={() => setLightboxImage(image)}
            sx={{
              width: 64,
              height: 64,
              objectFit: "cover",
              borderRadius: 1,
              border: 1,
              borderColor: "divider",
              cursor: "pointer",
            }}
          />
        ))}
      </Stack>

      {lightboxImage && (
        <Dialog
          open={!!lightboxImage}
          onClose={() => setLightboxImage(null)}
          maxWidth="md"
          fullWidth
        >
          <DialogContent sx={{ p: 0, position: "relative" }}>
            <Box
              component="img"
              src={noteImageUrl(lightboxImage.file_path)}
              alt={`Note image ${lightboxImage.id}`}
              sx={{ width: "100%", display: "block" }}
            />
          </DialogContent>
          <DialogActions sx={{ justifyContent: "flex-end", px: 2, py: 1 }}>
            <Button
              onClick={() => setLightboxImage(null)}
              aria-label="Close"
              startIcon={<CloseIcon />}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
