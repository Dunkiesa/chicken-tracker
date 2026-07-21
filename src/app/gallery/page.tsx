"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Card,
  Typography,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  ImageList,
  ImageListItem,
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { formatDateTimeForDisplay } from "@/lib/dateUtils";

type PhotoWithChicken = {
  id: number;
  chicken_id: number;
  file_path: string;
  thumbnail_path: string | null;
  description: string | null;
  recorded_by: string;
  created_at: string;
  chicken_name: string;
};

async function fetchAllPhotos(): Promise<PhotoWithChicken[]> {
  const res = await fetch("/api/photos");
  if (!res.ok) throw new Error("Failed to fetch photos");
  return res.json();
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i] as T;
    shuffled[i] = shuffled[j] as T;
    shuffled[j] = tmp;
  }
  return shuffled;
}

function photoSrc(photo: PhotoWithChicken): string {
  return `/api/photos/${photo.file_path.split("/").pop()}`;
}

function photoThumbSrc(photo: PhotoWithChicken): string {
  const thumbPath = photo.thumbnail_path ?? photo.file_path;
  return `/api/photos/${thumbPath.split("/").pop()}`;
}

type LightboxPhoto = PhotoWithChicken | null;

function PhotoGrid({
  photos,
  cols,
  onPhotoClick,
}: {
  photos: PhotoWithChicken[];
  cols: number;
  onPhotoClick: (photo: PhotoWithChicken) => void;
}) {
  if (photos.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
        No photos yet
      </Typography>
    );
  }

  return (
    <ImageList cols={cols} gap={8}>
      {photos.map((photo) => (
        <ImageListItem key={photo.id} sx={{ cursor: "pointer" }}>
          <Box
            onClick={() => onPhotoClick(photo)}
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              overflow: "hidden",
            }}
          >
            <Box
              component="img"
              src={photoThumbSrc(photo)}
              alt={photo.description || `${photo.chicken_name} photo`}
              loading="lazy"
              sx={{
                width: "100%",
                height: 150,
                objectFit: "cover",
                display: "block",
              }}
            />
          </Box>
          {photo.description && (
            <Typography variant="caption" display="block" sx={{ mt: 0.5, px: 0.5 }}>
              {photo.description}
            </Typography>
          )}
        </ImageListItem>
      ))}
    </ImageList>
  );
}

function ByChickenView({
  photos,
  cols,
  onPhotoClick,
}: {
  photos: PhotoWithChicken[];
  cols: number;
  onPhotoClick: (photo: PhotoWithChicken) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, PhotoWithChicken[]>();
    for (const photo of photos) {
      const existing = map.get(photo.chicken_name);
      if (existing) {
        existing.push(photo);
      } else {
        map.set(photo.chicken_name, [photo]);
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [photos]);

  if (grouped.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
        No photos yet
      </Typography>
    );
  }

  return (
    <>
      {grouped.map(([chickenName, chickenPhotos]) => (
        <Box key={chickenName} sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {chickenName}
          </Typography>
          <PhotoGrid photos={chickenPhotos} cols={cols} onPhotoClick={onPhotoClick} />
        </Box>
      ))}
    </>
  );
}

export default function GalleryPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));
  const cols = isMobile ? 2 : isTablet ? 3 : 4;

  const [tabIndex, setTabIndex] = useState(0);
  const [randomKey, setRandomKey] = useState(0);
  const [lightboxPhoto, setLightboxPhoto] = useState<LightboxPhoto>(null);

  const { data: photos, isLoading, error } = useQuery({
    queryKey: ["all-photos"],
    queryFn: fetchAllPhotos,
  });

  const chronologicalPhotos = useMemo(() => {
    if (!photos) return [];
    return [...photos].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [photos]);

  const randomPhotos = useMemo(() => {
    if (!photos) return [];
    void randomKey;
    return shuffleArray(photos);
  }, [photos, randomKey]);

  const handleTabChange = useCallback(
    (_: unknown, newValue: number) => {
      setTabIndex(newValue);
      if (newValue === 1) {
        setRandomKey((k) => k + 1);
      }
    },
    []
  );

  const handlePhotoClick = useCallback((photo: PhotoWithChicken) => {
    setLightboxPhoto(photo);
  }, []);

  const tabLabelId = (index: number) => `gallery-tab-${index}`;
  const tabPanelId = (index: number) => `gallery-tabpanel-${index}`;

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: { xs: 1, sm: 2 } }}>
      <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          aria-label="Gallery views"
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 2 }}
        >
          <Tab
            label="Chronological"
            id={tabLabelId(0)}
            aria-controls={tabPanelId(0)}
            sx={{ minWidth: { xs: 64, sm: 120 }, px: { xs: 1, sm: 2 } }}
          />
          <Tab
            label="Random"
            id={tabLabelId(1)}
            aria-controls={tabPanelId(1)}
            sx={{ minWidth: { xs: 64, sm: 90 }, px: { xs: 1, sm: 2 } }}
          />
          <Tab
            label="By Chicken"
            id={tabLabelId(2)}
            aria-controls={tabPanelId(2)}
            sx={{ minWidth: { xs: 64, sm: 100 }, px: { xs: 1, sm: 2 } }}
          />
        </Tabs>

        {isLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error">
            {error instanceof Error ? error.message : "Failed to load photos"}
          </Alert>
        )}

        {photos && (
          <>
            <Box
              role="tabpanel"
              hidden={tabIndex !== 0}
              id={tabPanelId(0)}
              aria-labelledby={tabLabelId(0)}
            >
              {tabIndex === 0 && (
                <PhotoGrid
                  photos={chronologicalPhotos}
                  cols={cols}
                  onPhotoClick={handlePhotoClick}
                />
              )}
            </Box>

            <Box
              role="tabpanel"
              hidden={tabIndex !== 1}
              id={tabPanelId(1)}
              aria-labelledby={tabLabelId(1)}
            >
              {tabIndex === 1 && (
                <PhotoGrid
                  photos={randomPhotos}
                  cols={cols}
                  onPhotoClick={handlePhotoClick}
                />
              )}
            </Box>

            <Box
              role="tabpanel"
              hidden={tabIndex !== 2}
              id={tabPanelId(2)}
              aria-labelledby={tabLabelId(2)}
            >
              {tabIndex === 2 && (
                <ByChickenView
                  photos={chronologicalPhotos}
                  cols={cols}
                  onPhotoClick={handlePhotoClick}
                />
              )}
            </Box>
          </>
        )}
      </Card>

      {lightboxPhoto && (
        <Dialog
          open={!!lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
          maxWidth="md"
          fullWidth
        >
          <DialogContent sx={{ p: 0, position: "relative" }}>
            <Box
              component="img"
              src={photoSrc(lightboxPhoto)}
              alt={lightboxPhoto.description || `${lightboxPhoto.chicken_name} photo`}
              sx={{ width: "100%", display: "block" }}
            />
          </DialogContent>
          <DialogActions sx={{ justifyContent: "space-between", px: 2, py: 1 }}>
            <Box>
              <Typography variant="subtitle2">{lightboxPhoto.chicken_name}</Typography>
              {lightboxPhoto.description && (
                <Typography variant="body2">{lightboxPhoto.description}</Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {formatDateTimeForDisplay(lightboxPhoto.created_at)}
              </Typography>
            </Box>
            <Button onClick={() => setLightboxPhoto(null)} aria-label="Close">
              <CloseIcon />
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
