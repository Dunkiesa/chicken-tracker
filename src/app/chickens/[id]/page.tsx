"use client";

import { useState, useMemo, Suspense, memo } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient, useQueries } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Stack,
  TextField,
  Autocomplete,
  Skeleton,
  MenuItem,
  Chip,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ImageList,
  ImageListItem,
  List,
  ListItem,
  ListItemText,
  Grid,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import CropDialog from "@/components/CropDialog";
import NoteImageManager from "@/components/NoteImageManager";
import NoteImagesInline from "@/components/NoteImagesInline";
import type { NoteImageEntry, CropRegion } from "@/components/NoteImageManager";
import type { NoteImageForDisplay } from "@/components/NoteImagesInline";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import StarIcon from "@mui/icons-material/Star";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import {
  todayStr,
  formatDateForPicker,
  formatDateForApi,
  formatDateForDisplay,
  formatDateTimeForDisplay,
} from "@/lib/dateUtils";

type Chicken = {
  id: number;
  name: string;
  sex: string;
  breed_name: string | null;
  origin_source_name: string | null;
  acquisition_type_name: string | null;
  acquisition_date: string | null;
  departed: boolean;
  departure_date: string | null;
  departure_reason: string | null;
  created_at: string;
  primary_photo_id: number | null;
  primary_photo_path: string | null;
  primary_thumbnail_path: string | null;
};

type Note = {
  id: number;
  chicken_id: number;
  chicken_name: string;
  content: string;
  date: string;
  recorded_by: string;
  created_at: string;
  updated_at: string;
};

type Photo = {
  id: number;
  chicken_id: number;
  file_path: string;
  thumbnail_path: string | null;
  description: string | null;
  recorded_by: string;
  created_at: string;
};

type NoteImage = {
  id: number;
  note_id: number | null;
  chicken_id: number;
  file_path: string;
  thumbnail_path: string | null;
  status: string;
  recorded_by: string;
  created_at: string;
};

type DynamicListEntry = {
  id: number;
  value: string;
};

const SEX_OPTIONS = ["Hen", "Rooster", "Unknown"] as const;

const sexBadgeSx: Record<string, { bgcolor: string; color: string }> = {
  Hen: { bgcolor: "secondary.light", color: "secondary.dark" },
  Rooster: { bgcolor: "primary.light", color: "primary.dark" },
};
const defaultSexBadgeSx = { bgcolor: "action.disabledBackground", color: "text.secondary" };

async function fetchChickenApi(id: number): Promise<Chicken> {
  const res = await fetch(`/api/chickens/${id}`);
  if (!res.ok) throw new Error("Failed to fetch chicken");
  return res.json();
}

async function fetchNotesApi(chickenId: number): Promise<Note[]> {
  const res = await fetch(`/api/chickens/${chickenId}/notes`);
  if (!res.ok) throw new Error("Failed to fetch notes");
  return res.json();
}

async function fetchPhotosApi(chickenId: number): Promise<Photo[]> {
  const res = await fetch(`/api/chickens/${chickenId}/photos`);
  if (!res.ok) throw new Error("Failed to fetch photos");
  return res.json();
}

async function fetchDynamicListApi(type: string): Promise<DynamicListEntry[]> {
  const res = await fetch(`/api/dynamic-lists/${type}`);
  if (!res.ok) throw new Error(`Failed to fetch ${type}`);
  return res.json();
}

async function createNoteApi(data: {
  chickenId: number;
  content: string;
  date: string;
  imageIds?: number[];
  crops?: Record<string, CropRegion>;
}): Promise<Note> {
  const res = await fetch(`/api/chickens/${data.chickenId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: data.content,
      date: data.date,
      imageIds: data.imageIds,
      crops: data.crops,
    }),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.message || "Failed to add note");
  }
  return res.json();
}

async function updateNoteApi(data: {
  chickenId: number;
  noteId: number;
  content: string;
  date: string;
  imageIds?: number[];
  crops?: Record<string, CropRegion>;
}): Promise<Note> {
  const res = await fetch(`/api/chickens/${data.chickenId}/notes/${data.noteId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: data.content,
      date: data.date,
      imageIds: data.imageIds,
      crops: data.crops,
    }),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.message || "Failed to update note");
  }
  return res.json();
}

async function deleteNoteApi(data: {
  chickenId: number;
  noteId: number;
}): Promise<void> {
  const res = await fetch(`/api/chickens/${data.chickenId}/notes/${data.noteId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.message || "Failed to delete note");
  }
}

async function fetchNoteImagesApi(chickenId: number, noteId: number): Promise<NoteImage[]> {
  const res = await fetch(`/api/chickens/${chickenId}/notes/images?noteId=${noteId}`);
  if (!res.ok) throw new Error("Failed to fetch note images");
  return res.json();
}

async function uploadPhotoApi(data: {
  chickenId: number;
  file: File;
  description?: string;
}): Promise<Photo> {
  const formData = new FormData();
  formData.append("file", data.file);
  if (data.description) {
    formData.append("description", data.description);
  }
  const res = await fetch(`/api/chickens/${data.chickenId}/photos`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.message || "Failed to upload photo");
  }
  return res.json();
}

async function deletePhotoApi(data: {
  chickenId: number;
  photoId: number;
}): Promise<void> {
  const res = await fetch(`/api/chickens/${data.chickenId}/photos/${data.photoId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.message || "Failed to delete photo");
  }
}

async function setPrimaryPhotoApi(data: {
  chickenId: number;
  photoId: number;
  crop?: { x: number; y: number; width: number; height: number };
}): Promise<void> {
  const res = await fetch(
    `/api/chickens/${data.chickenId}/photos/${data.photoId}/primary`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data.crop ? { crop: data.crop } : {}),
    }
  );
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.message || "Failed to set primary photo");
  }
}

async function updateChickenApi(
  id: number,
  data: Record<string, unknown>
): Promise<Chicken> {
  const res = await fetch(`/api/chickens/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.message || "Failed to update chicken");
  }
  return res.json();
}

const addNoteSchema = z.object({
  content: z.string().min(1, "Content is required"),
  date: z.string().min(1, "Date is required"),
});

type AddNoteFormValues = z.infer<typeof addNoteSchema>;

const editNoteSchema = z.object({
  content: z.string().min(1, "Content is required"),
  date: z.string().min(1, "Date is required"),
});

type EditNoteFormValues = z.infer<typeof editNoteSchema>;

function buildImagePayload(images: NoteImageEntry[]): {
  imageIds?: number[];
  crops?: Record<string, CropRegion>;
} {
  const imageIds = images.map((i) => i.id);
  const crops: Record<string, CropRegion> = {};
  for (const img of images) {
    if (img.crop) {
      crops[String(img.id)] = img.crop;
    }
  }
  return {
    imageIds: imageIds.length > 0 ? imageIds : undefined,
    crops: Object.keys(crops).length > 0 ? crops : undefined,
  };
}

function bboxToCropRegion(bbox: [number, number, number, number]): CropRegion {
  return { x_min: bbox[0], y_min: bbox[1], x_max: bbox[2], y_max: bbox[3] };
}

function makeAISuggestionHandler(
  getContent: () => string,
  setContent: (value: string) => void,
  images: NoteImageEntry[],
  setImages: (images: NoteImageEntry[]) => void
) {
  return (imageId: number, text: string, bbox: [number, number, number, number] | null) => {
    const current = getContent();
    const separator = current.trim() ? "\n\n---\n\n" : "";
    setContent(current + separator + text);
    if (bbox) {
      setImages(
        images.map((i) =>
          i.id === imageId ? { ...i, crop: bboxToCropRegion(bbox) } : i
        )
      );
    }
  };
}

const uploadPhotoSchema = z.object({
  description: z.string(),
});

type UploadPhotoFormValues = z.infer<typeof uploadPhotoSchema>;

const editChickenSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    sex: z.enum(["Hen", "Rooster", "Unknown"]),
    breed: z.string(),
    origin_source: z.string(),
    acquisition_type: z.string(),
    acquisition_date: z.string(),
    departed: z.boolean(),
    departure_date: z.string(),
    departure_reason: z.string(),
  })
  .refine(
    (data) => {
      if (data.departed && !data.departure_date) {
        return false;
      }
      return true;
    },
    {
      message: "Departure date is required when marking as departed",
      path: ["departure_date"],
    }
  );

type EditChickenFormValues = z.infer<typeof editChickenSchema>;

export default function ChickenProfilePage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}

function ProfileContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const chickenId = parseInt(params.id as string, 10);
  const isAdmin = session?.user?.role === "Admin";

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addNoteDialogOpen, setAddNoteDialogOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [deleteNoteDialogId, setDeleteNoteDialogId] = useState<number | null>(null);
  const [deletePhotoDialogId, setDeletePhotoDialogId] = useState<number | null>(null);
  const [cropDialogPhoto, setCropDialogPhoto] = useState<Photo | null>(null);
  const [cropPending, setCropPending] = useState(false);
  const [uploadSetPrimary, setUploadSetPrimary] = useState(false);
  const [addNoteImages, setAddNoteImages] = useState<NoteImageEntry[]>([]);

  const {
    data: chicken,
    isLoading: chickenLoading,
    error: chickenError,
  } = useQuery({
    queryKey: ["chicken", chickenId],
    queryFn: () => fetchChickenApi(chickenId),
    enabled: status === "authenticated" && !isNaN(chickenId),
  });

  const { data: notes } = useQuery({
    queryKey: ["chicken-notes", chickenId],
    queryFn: () => fetchNotesApi(chickenId),
    enabled: status === "authenticated" && !isNaN(chickenId),
  });

  const noteImageResults = useQueries({
    queries: (notes ?? []).map((note) => ({
      queryKey: ["note-images", chickenId, note.id],
      queryFn: () => fetchNoteImagesApi(chickenId, note.id),
      enabled: status === "authenticated" && !isNaN(chickenId),
    })),
  });

  const noteImagesMap = useMemo(() => {
    const map: Record<number, NoteImageForDisplay[]> = {};
    (notes ?? []).forEach((note, i) => {
      const data = noteImageResults[i]?.data;
      if (data) {
        map[note.id] = data.map((img) => ({
          id: img.id,
          file_path: img.file_path,
          thumbnail_path: img.thumbnail_path,
        }));
      }
    });
    return map;
  }, [notes, noteImageResults]);

  const { data: photos } = useQuery({
    queryKey: ["chicken-photos", chickenId],
    queryFn: () => fetchPhotosApi(chickenId),
    enabled: status === "authenticated" && !isNaN(chickenId),
  });

  const { data: breeds } = useQuery({
    queryKey: ["dynamic-lists", "breeds"],
    queryFn: () => fetchDynamicListApi("breeds"),
    enabled: status === "authenticated",
  });

  const { data: originSources } = useQuery({
    queryKey: ["dynamic-lists", "origin-sources"],
    queryFn: () => fetchDynamicListApi("origin-sources"),
    enabled: status === "authenticated",
  });

  const { data: acquisitionTypes } = useQuery({
    queryKey: ["dynamic-lists", "acquisition-types"],
    queryFn: () => fetchDynamicListApi("acquisition-types"),
    enabled: status === "authenticated",
  });

  const editChickenMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      updateChickenApi(chickenId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chicken", chickenId] });
      setEditDialogOpen(false);
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (data: { content: string; date: string; imageIds?: number[]; crops?: Record<string, CropRegion> }) =>
      createNoteApi({ chickenId, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chicken-notes", chickenId] });
      setAddNoteDialogOpen(false);
      setAddNoteImages([]);
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: (data: {
      noteId: number;
      content: string;
      date: string;
      imageIds?: number[];
      crops?: Record<string, CropRegion>;
    }) => updateNoteApi({ chickenId, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chicken-notes", chickenId] });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: number) => deleteNoteApi({ chickenId, noteId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chicken-notes", chickenId] });
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: (data: { file: File; description?: string }) =>
      uploadPhotoApi({ chickenId, ...data }),
    onSuccess: (photo: Photo) => {
      queryClient.invalidateQueries({ queryKey: ["chicken-photos", chickenId] });
      queryClient.invalidateQueries({ queryKey: ["chicken", chickenId] });
      setUploadDialogOpen(false);
      setFileInputKey((k) => k + 1);
      if (uploadSetPrimary) {
        setUploadSetPrimary(false);
        setCropDialogPhoto(photo);
      }
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: number) => deletePhotoApi({ chickenId, photoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chicken-photos", chickenId] });
      queryClient.invalidateQueries({ queryKey: ["chicken", chickenId] });
    },
  });

  const setPrimaryPhotoMutation = useMutation({
    mutationFn: (data: { photoId: number; crop?: { x: number; y: number; width: number; height: number } }) =>
      setPrimaryPhotoApi({ chickenId, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chicken", chickenId] });
      setCropDialogPhoto(null);
      setCropPending(false);
    },
    onError: () => {
      setCropPending(false);
    },
  });

  const editChickenForm = useForm<EditChickenFormValues>({
    resolver: zodResolver(editChickenSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      sex: "Unknown",
      breed: "",
      origin_source: "",
      acquisition_type: "",
      acquisition_date: "",
      departed: false,
      departure_date: "",
      departure_reason: "",
    },
  });

  const addNoteForm = useForm<AddNoteFormValues>({
    resolver: zodResolver(addNoteSchema),
    mode: "onBlur",
    defaultValues: {
      content: "",
      date: todayStr(),
    },
  });

  const breedOptions = useMemo(
    () => breeds?.map((b) => b.value) ?? [],
    [breeds]
  );
  const originOptions = useMemo(
    () => originSources?.map((o) => o.value) ?? [],
    [originSources]
  );
  const acqOptions = useMemo(
    () => acquisitionTypes?.map((a) => a.value) ?? [],
    [acquisitionTypes]
  );

  const handleOpenEditDialog = () => {
    if (!chicken) return;
    editChickenForm.reset({
      name: chicken.name,
      sex: chicken.sex as "Hen" | "Rooster" | "Unknown",
      breed: chicken.breed_name || "",
      origin_source: chicken.origin_source_name || "",
      acquisition_type: chicken.acquisition_type_name || "",
      acquisition_date: chicken.acquisition_date || "",
      departed: chicken.departed,
      departure_date: chicken.departure_date || "",
      departure_reason: chicken.departure_reason || "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = (data: EditChickenFormValues) => {
    const updates: Record<string, unknown> = {
      name: data.name,
      sex: data.sex,
    };
    if (data.breed) updates.breed = data.breed;
    if (data.origin_source) updates.origin_source = data.origin_source;
    if (data.acquisition_type) updates.acquisition_type = data.acquisition_type;
    updates.acquisition_date = data.acquisition_date || null;
    updates.departed = data.departed;
    if (data.departure_date) updates.departure_date = data.departure_date;
    if (data.departure_reason) updates.departure_reason = data.departure_reason;
    editChickenMutation.mutate(updates);
  };

  const handleOpenAddNoteDialog = () => {
    addNoteForm.reset({
      content: "",
      date: todayStr(),
    });
    setAddNoteImages([]);
    addNoteMutation.reset();
    setAddNoteDialogOpen(true);
  };

  const handleAddNote = (data: AddNoteFormValues) => {
    addNoteMutation.mutate({
      ...data,
      ...buildImagePayload(addNoteImages),
    });
  };

  const handleDeleteNote = (noteId: number) => {
    setDeleteNoteDialogId(noteId);
  };

  const handleOpenUploadDialog = () => {
    uploadPhotoMutation.reset();
    setUploadDialogOpen(true);
  };

  const handleUploadPhoto = (file: File, description: string) => {
    uploadPhotoMutation.mutate({ file, description });
  };

  const handleSetPrimary = (photo: Photo) => {
    setCropDialogPhoto(photo);
  };

  const handleCropConfirm = (crop: { x: number; y: number; width: number; height: number }) => {
    if (!cropDialogPhoto) return;
    setCropPending(true);
    setPrimaryPhotoMutation.mutate({ photoId: cropDialogPhoto.id, crop });
  };

  const handleCropCancel = () => {
    setCropDialogPhoto(null);
  };

  const handleDeletePhoto = (photoId: number) => {
    setDeletePhotoDialogId(photoId);
  };

  const canModifyNote = (note: Note) =>
    isAdmin || note.recorded_by === session?.user?.email;

  if (status === "loading") {
    return (
      <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (status === "unauthenticated") {
    router.replace("/");
    return null;
  }

  if (isNaN(chickenId)) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">Invalid chicken ID</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 700, mx: "auto", p: 2 }}>
      {chickenLoading ? (
        <Stack spacing={2}>
          <Skeleton variant="rectangular" height={200} />
          <Skeleton variant="text" height={40} />
          <Skeleton variant="rectangular" height={300} />
        </Stack>
      ) : chickenError ? (
        <Alert severity="error">Failed to load chicken</Alert>
      ) : chicken ? (
        <Stack spacing={3}>
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h5">{chicken.name}</Typography>
              <Stack direction="row" spacing={1}>
                {isAdmin && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleOpenEditDialog}
                    aria-label="Edit"
                    sx={{ minWidth: 0, p: 1, width: 38, height: 38 }}
                  >
                    <EditIcon />
                  </Button>
                )}
                <Button
                  variant="outlined"
                  component={Link}
                  href="/roster"
                >
                  <ArrowBackIcon />
                </Button>
              </Stack>
            </Stack>
          </Box>

          <ChickenInfoCard chicken={chicken} />

          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Photos</Typography>
                {isAdmin && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleOpenUploadDialog}
                    aria-label="Upload photo"
                    sx={{ minWidth: 0, p: 1, width: 38, height: 38 }}
                  >
                    <PhotoCameraIcon />
                  </Button>
                )}
              </Stack>
              <PhotoGallery
                photos={photos ?? []}
                primaryPhotoId={chicken.primary_photo_id}
                isAdmin={isAdmin}
                onPhotoClick={setLightboxPhoto}
                onSetPrimary={handleSetPrimary}
                onDeletePhoto={handleDeletePhoto}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Notes Log</Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleOpenAddNoteDialog}
                  aria-label="Add note"
                  sx={{ minWidth: 0, p: 1, width: 38, height: 38 }}
                >
                  <AddIcon />
                </Button>
              </Stack>
              <NotesList
                notes={notes ?? []}
                isAdmin={isAdmin}
                canModifyNote={canModifyNote}
                onDeleteNote={handleDeleteNote}
                onUpdateNote={(noteId, data) => updateNoteMutation.mutate({ noteId, ...data })}
                updateNotePending={updateNoteMutation.isPending}
                noteImagesMap={noteImagesMap}
                chickenId={chickenId}
              />
            </CardContent>
          </Card>
        </Stack>
      ) : null}

      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <Box
          component="form"
          onSubmit={editChickenForm.handleSubmit(handleSaveEdit)}
        >
          <DialogTitle>Edit Chicken</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Controller
                name="name"
                control={editChickenForm.control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Name"
                    error={!!editChickenForm.formState.errors.name}
                    helperText={editChickenForm.formState.errors.name?.message}
                    fullWidth
                    size="small"
                  />
                )}
              />
              <Controller
                name="sex"
                control={editChickenForm.control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="Sex"
                    error={!!editChickenForm.formState.errors.sex}
                    helperText={editChickenForm.formState.errors.sex?.message}
                    fullWidth
                    size="small"
                  >
                    {SEX_OPTIONS.map((s) => (
                      <MenuItem key={s} value={s}>
                        {s}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <Controller
                name="breed"
                control={editChickenForm.control}
                render={({ field }) => (
                  <Autocomplete
                    freeSolo
                    options={breedOptions}
                    value={field.value || ""}
                    onChange={(_, newValue) => field.onChange(newValue || "")}
                    onInputChange={(_, newValue, reason) => {
                      if (reason === "input") {
                        field.onChange(newValue);
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Breed (pick or type new)"
                        error={!!editChickenForm.formState.errors.breed}
                        helperText={editChickenForm.formState.errors.breed?.message}
                        size="small"
                      />
                    )}
                  />
                )}
              />
              <Controller
                name="origin_source"
                control={editChickenForm.control}
                render={({ field }) => (
                  <Autocomplete
                    freeSolo
                    options={originOptions}
                    value={field.value || ""}
                    onChange={(_, newValue) => field.onChange(newValue || "")}
                    onInputChange={(_, newValue, reason) => {
                      if (reason === "input") {
                        field.onChange(newValue);
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Origin source (pick or type new)"
                        error={!!editChickenForm.formState.errors.origin_source}
                        helperText={
                          editChickenForm.formState.errors.origin_source?.message
                        }
                        size="small"
                      />
                    )}
                  />
                )}
              />
              <Controller
                name="acquisition_type"
                control={editChickenForm.control}
                render={({ field }) => (
                  <Autocomplete
                    freeSolo
                    options={acqOptions}
                    value={field.value || ""}
                    onChange={(_, newValue) => field.onChange(newValue || "")}
                    onInputChange={(_, newValue, reason) => {
                      if (reason === "input") {
                        field.onChange(newValue);
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Acquisition type (pick or type new)"
                        error={!!editChickenForm.formState.errors.acquisition_type}
                        helperText={
                          editChickenForm.formState.errors.acquisition_type?.message
                        }
                        size="small"
                      />
                    )}
                  />
                )}
              />
              <Controller
                name="acquisition_date"
                control={editChickenForm.control}
                render={({ field }) => (
                  <DatePicker
                    label="Acquisition date"
                    value={field.value ? formatDateForPicker(field.value) : null}
                    onChange={(date) => field.onChange(formatDateForApi(date))}
                    closeOnSelect
                    slotProps={{
                      textField: {
                        error: !!editChickenForm.formState.errors.acquisition_date,
                        helperText:
                          editChickenForm.formState.errors.acquisition_date?.message,
                        size: "small",
                        fullWidth: true,
                      },
                    }}
                  />
                )}
              />
              <Controller
                name="departed"
                control={editChickenForm.control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    }
                    label="Departed"
                  />
                )}
              />
              {editChickenForm.watch("departed") && (
                <>
                  <Controller
                    name="departure_date"
                    control={editChickenForm.control}
                    render={({ field }) => (
                      <DatePicker
                        label="Departure date"
                        value={field.value ? formatDateForPicker(field.value) : null}
                        onChange={(date) => field.onChange(formatDateForApi(date))}
                        closeOnSelect
                        slotProps={{
                          textField: {
                            error: !!editChickenForm.formState.errors.departure_date,
                            helperText:
                              editChickenForm.formState.errors.departure_date?.message,
                            size: "small",
                            fullWidth: true,
                          },
                        }}
                      />
                    )}
                  />
                  <Controller
                    name="departure_reason"
                    control={editChickenForm.control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Departure reason (optional)"
                        fullWidth
                        size="small"
                      />
                    )}
                  />
                </>
              )}
              {editChickenMutation.isError && (
                <Alert severity="error">{editChickenMutation.error.message}</Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)} disabled={editChickenMutation.isPending} aria-label="Cancel">
              <CloseIcon />
            </Button>
            <Button type="submit" variant="contained" disabled={editChickenMutation.isPending} aria-label={editChickenMutation.isPending ? "Saving" : "Save"}>
              {editChickenMutation.isPending ? <CircularProgress size={20} /> : <CheckIcon />}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog
        open={addNoteDialogOpen}
        onClose={() => setAddNoteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <Box component="form" onSubmit={addNoteForm.handleSubmit(handleAddNote)}>
          <DialogTitle>Add Note</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Controller
                name="content"
                control={addNoteForm.control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Note content"
                    multiline
                    rows={4}
                    error={!!addNoteForm.formState.errors.content}
                    helperText={addNoteForm.formState.errors.content?.message}
                    fullWidth
                  />
                )}
              />
              <Controller
                name="date"
                control={addNoteForm.control}
                render={({ field }) => (
                  <DatePicker
                    label="Date"
                    value={field.value ? formatDateForPicker(field.value) : null}
                    onChange={(date) => field.onChange(formatDateForApi(date))}
                    closeOnSelect
                    slotProps={{
                      textField: {
                        error: !!addNoteForm.formState.errors.date,
                        helperText: addNoteForm.formState.errors.date?.message,
                        fullWidth: true,
                      },
                    }}
                  />
                )}
              />
              <NoteImageManager
                chickenId={chickenId}
                images={addNoteImages}
                onChange={setAddNoteImages}
                disabled={addNoteMutation.isPending}
                onAISuggestion={makeAISuggestionHandler(
                  () => addNoteForm.getValues("content") || "",
                  (v) => addNoteForm.setValue("content", v, { shouldDirty: true }),
                  addNoteImages,
                  setAddNoteImages
                )}
              />
              {addNoteMutation.isError && (
                <Alert severity="error">{addNoteMutation.error.message}</Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddNoteDialogOpen(false)} disabled={addNoteMutation.isPending} aria-label="Cancel">
              <CloseIcon />
            </Button>
            <Button type="submit" variant="contained" disabled={addNoteMutation.isPending || addNoteImages.some((i) => i.status === "processing")} aria-label={addNoteMutation.isPending ? "Adding" : "Add"}>
              {addNoteMutation.isPending ? <CircularProgress size={20} /> : <CheckIcon />}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog
        open={uploadDialogOpen}
        onClose={() => {
          setUploadDialogOpen(false);
          setUploadSetPrimary(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <UploadPhotoForm
          fileInputKey={fileInputKey}
          onUpload={handleUploadPhoto}
          isPending={uploadPhotoMutation.isPending}
          error={uploadPhotoMutation.isError ? uploadPhotoMutation.error.message : null}
          setPrimary={uploadSetPrimary}
          onSetPrimaryChange={setUploadSetPrimary}
        />
      </Dialog>

      {cropDialogPhoto && (
        <CropDialog
          open={!!cropDialogPhoto}
          imageUrl={`/api/photos/${cropDialogPhoto.file_path}`}
          onCrop={handleCropConfirm}
          onCancel={handleCropCancel}
          pending={cropPending}
        />
      )}

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
              src={`/api/photos/${lightboxPhoto.file_path}`}
              alt={lightboxPhoto.description || "Chicken photo"}
              sx={{ width: "100%", display: "block" }}
            />
          </DialogContent>
          <DialogActions sx={{ justifyContent: "space-between", px: 2, py: 1 }}>
            <Box>
              {lightboxPhoto.description && (
                <Typography variant="body2">{lightboxPhoto.description}</Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {formatDateTimeForDisplay(lightboxPhoto.created_at)} · {lightboxPhoto.recorded_by}
              </Typography>
            </Box>
            <Button onClick={() => setLightboxPhoto(null)} aria-label="Close">
              <CloseIcon />
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <ConfirmDialog
        open={deleteNoteDialogId !== null}
        title="Delete Note"
        message="Delete this note?"
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteNoteDialogId !== null) {
            deleteNoteMutation.mutate(deleteNoteDialogId);
          }
          setDeleteNoteDialogId(null);
        }}
        onCancel={() => setDeleteNoteDialogId(null)}
        pending={deleteNoteMutation.isPending}
      />

      <ConfirmDialog
        open={deletePhotoDialogId !== null}
        title="Delete Photo"
        message="Delete this photo?"
        confirmLabel="Delete"
        onConfirm={() => {
          if (deletePhotoDialogId !== null) {
            deletePhotoMutation.mutate(deletePhotoDialogId);
          }
          setDeletePhotoDialogId(null);
        }}
        onCancel={() => setDeletePhotoDialogId(null)}
        pending={deletePhotoMutation.isPending}
      />
    </Box>
  );
}

function ChickenInfoCard({ chicken }: { chicken: Chicken }) {
  const sexSx = sexBadgeSx[chicken.sex] ?? defaultSexBadgeSx;

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          <Avatar
            src={
              (chicken.primary_thumbnail_path || chicken.primary_photo_path)
                ? `/api/photos/${chicken.primary_thumbnail_path || chicken.primary_photo_path}`
                : undefined
            }
            alt={chicken.name}
            sx={{ width: 80, height: 80 }}
          />
          <Box flex={1}>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <Chip
                label={chicken.sex}
                size="small"
                sx={{
                  bgcolor: sexSx.bgcolor,
                  color: sexSx.color,
                  fontWeight: 600,
                }}
              />
              <Chip
                label={chicken.departed ? "Departed" : "Active"}
                size="small"
                sx={{
                  bgcolor: chicken.departed ? "error.light" : "success.light",
                  color: chicken.departed ? "error.dark" : "success.dark",
                  fontWeight: 600,
                }}
              />
            </Stack>
            {chicken.departed && chicken.departure_date && (
              <Typography variant="caption" color="text.secondary">
                Departed {formatDateForDisplay(chicken.departure_date)}
                {chicken.departure_reason && ` · ${chicken.departure_reason}`}
              </Typography>
            )}
          </Box>
        </Stack>
        <Grid container spacing={1}>
          <Grid size={{ xs: 4 }}>
            <Typography variant="caption" color="text.secondary">
              Breed
            </Typography>
            <Typography variant="body2">{chicken.breed_name || "-"}</Typography>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <Typography variant="caption" color="text.secondary">
              Origin
            </Typography>
            <Typography variant="body2">{chicken.origin_source_name || "-"}</Typography>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <Typography variant="caption" color="text.secondary">
              Acquisition
            </Typography>
            <Typography variant="body2">{chicken.acquisition_type_name || "-"}</Typography>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Typography variant="caption" color="text.secondary">
              Acquisition Date
            </Typography>
            <Typography variant="body2">{chicken.acquisition_date ? formatDateForDisplay(chicken.acquisition_date) : "-"}</Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

function PhotoGallery({
  photos,
  primaryPhotoId,
  isAdmin,
  onPhotoClick,
  onSetPrimary,
  onDeletePhoto,
}: {
  photos: Photo[];
  primaryPhotoId: number | null;
  isAdmin: boolean;
  onPhotoClick: (photo: Photo) => void;
  onSetPrimary: (photo: Photo) => void;
  onDeletePhoto: (photoId: number) => void;
}) {
  if (photos.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
        No photos yet
      </Typography>
    );
  }

  return (
    <ImageList cols={3} gap={8}>
      {photos.map((photo) => {
        const isPrimary = primaryPhotoId === photo.id;
        return (
          <ImageListItem key={photo.id} sx={{ cursor: "pointer" }}>
            <Box
              onClick={() => onPhotoClick(photo)}
              sx={{
                position: "relative",
                border: isPrimary ? 2 : 1,
                borderColor: isPrimary ? "success.main" : "divider",
                borderRadius: 1,
                overflow: "hidden",
              }}
            >
              <Box
                component="img"
                src={`/api/photos/${photo.file_path}`}
                alt={photo.description || "Chicken photo"}
                sx={{
                  width: "100%",
                  height: 120,
                  objectFit: "cover",
                  display: "block",
                }}
              />
              {isPrimary && (
                <Chip
                  icon={<StarIcon sx={{ fontSize: 14 }} />}
                  label="Primary"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetPrimary(photo);
                  }}
                  sx={{
                    position: "absolute",
                    top: 4,
                    left: 4,
                    bgcolor: "success.main",
                    color: "success.contrastText",
                    fontSize: "0.7rem",
                    cursor: "pointer",
                  }}
                />
              )}
              {isAdmin && (
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    bgcolor: (theme) => alpha(theme.palette.common.black, 0.6),
                    display: "flex",
                    justifyContent: "flex-end",
                    p: 0.5,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {!isPrimary && (
                    <IconButton
                      size="small"
                      onClick={() => onSetPrimary(photo)}
                      sx={{
                        color: "success.contrastText",
                        bgcolor: (theme) => alpha(theme.palette.success.main, 0.5),
                        "&:hover": {
                          bgcolor: (theme) => alpha(theme.palette.success.main, 0.7),
                        },
                      }}
                    >
                      <StarIcon fontSize="small" />
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    onClick={() => onDeletePhoto(photo.id)}
                    sx={{
                      color: "error.contrastText",
                      bgcolor: (theme) => alpha(theme.palette.error.main, 0.5),
                      "&:hover": {
                        bgcolor: (theme) => alpha(theme.palette.error.main, 0.7),
                      },
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </Box>
            {photo.description && (
              <Typography variant="caption" display="block" sx={{ mt: 0.5, px: 0.5 }}>
                {photo.description}
              </Typography>
            )}
          </ImageListItem>
        );
      })}
    </ImageList>
  );
}

function UploadPhotoForm({
  fileInputKey,
  onUpload,
  isPending,
  error,
  setPrimary,
  onSetPrimaryChange,
}: {
  fileInputKey: number;
  onUpload: (file: File, description: string) => void;
  isPending: boolean;
  error: string | null;
  setPrimary: boolean;
  onSetPrimaryChange: (value: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    onUpload(file, description);
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <DialogTitle>Upload Photo</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <input
            key={fileInputKey}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={isPending}
          />
          <TextField
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isPending}
            fullWidth
            size="small"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={setPrimary}
                onChange={(e) => onSetPrimaryChange(e.target.checked)}
                disabled={isPending}
              />
            }
            label="Set as primary (crop after upload)"
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setFile(null)} disabled={isPending} aria-label="Cancel">
          <CloseIcon />
        </Button>
        <Button type="submit" variant="contained" disabled={isPending || !file} aria-label={isPending ? "Uploading" : "Upload"}>
          {isPending ? <CircularProgress size={20} /> : <CloudUploadIcon />}
        </Button>
      </DialogActions>
    </Box>
  );
}

function NotesList({
  notes,
  isAdmin,
  canModifyNote,
  onDeleteNote,
  onUpdateNote,
  updateNotePending,
  noteImagesMap,
  chickenId,
}: {
  notes: Note[];
  isAdmin: boolean;
  canModifyNote: (note: Note) => boolean;
  onDeleteNote: (noteId: number) => void;
  onUpdateNote: (noteId: number, data: { content: string; date: string; imageIds?: number[]; crops?: Record<string, CropRegion> }) => void;
  updateNotePending: boolean;
  noteImagesMap: Record<number, NoteImageForDisplay[]>;
  chickenId: number;
}) {
  if (notes.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
        No notes yet
      </Typography>
    );
  }

  return (
    <List>
      {notes.map((note) => (
        <NoteItem
          key={note.id}
          note={note}
          isAdmin={isAdmin}
          canModify={canModifyNote(note)}
          onDelete={() => onDeleteNote(note.id)}
          onSave={(data) => onUpdateNote(note.id, data)}
          savePending={updateNotePending}
          images={noteImagesMap[note.id] ?? []}
          chickenId={chickenId}
        />
      ))}
    </List>
  );
}

const NoteItem = memo(function NoteItem({
  note,
  isAdmin,
  canModify,
  onDelete,
  onSave,
  savePending,
  images,
  chickenId,
}: {
  note: Note;
  isAdmin: boolean;
  canModify: boolean;
  onDelete: () => void;
  onSave: (data: { content: string; date: string; imageIds?: number[]; crops?: Record<string, CropRegion> }) => void;
  savePending: boolean;
  images: NoteImageForDisplay[];
  chickenId: number;
}) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editNoteImages, setEditNoteImages] = useState<NoteImageEntry[]>([]);

  const form = useForm<EditNoteFormValues>({
    resolver: zodResolver(editNoteSchema),
    mode: "onBlur",
    values: {
      content: note.content,
      date: note.date,
    },
  });

  const handleOpenEdit = () => {
    setEditNoteImages(
      images.map((img) => ({ id: img.id, file_path: img.file_path, crop: null, status: "pending" as const }))
    );
    setEditDialogOpen(true);
  };

  const handleSubmit = (data: EditNoteFormValues) => {
    onSave({
      ...data,
      ...buildImagePayload(editNoteImages),
    });
    setEditDialogOpen(false);
  };

  return (
    <>
      <ListItem
        alignItems="flex-start"
        sx={{
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          mb: 1,
          bgcolor: "action.hover",
        }}
        slotProps={{
          secondaryAction: canModify && (
            <Stack direction="row" spacing={0.5}>
              <IconButton size="small" onClick={handleOpenEdit}>
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={onDelete} color="error">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ),
        }}
      >
        <ListItemText
          primary={
            <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
              <Typography variant="body2" fontWeight={600}>
                {formatDateForDisplay(note.date)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {note.recorded_by}
              </Typography>
            </Stack>
          }
          secondary={
            <>
              <Typography
                variant="body2"
                sx={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}
              >
                {note.content}
              </Typography>
              <NoteImagesInline images={images} />
            </>
          }
        />
      </ListItem>

      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <Box component="form" onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogTitle>Edit Note</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Controller
                name="content"
                control={form.control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Note content"
                    multiline
                    rows={4}
                    error={!!form.formState.errors.content}
                    helperText={form.formState.errors.content?.message}
                    fullWidth
                  />
                )}
              />
              <Controller
                name="date"
                control={form.control}
                render={({ field }) => (
                  <DatePicker
                    label="Date"
                    value={field.value ? formatDateForPicker(field.value) : null}
                    onChange={(date) => field.onChange(formatDateForApi(date))}
                    closeOnSelect
                    slotProps={{
                      textField: {
                        error: !!form.formState.errors.date,
                        helperText: form.formState.errors.date?.message,
                        fullWidth: true,
                      },
                    }}
                  />
                )}
              />
              <NoteImageManager
                chickenId={chickenId}
                images={editNoteImages}
                onChange={setEditNoteImages}
                disabled={savePending}
                onAISuggestion={makeAISuggestionHandler(
                  () => form.getValues("content") || "",
                  (v) => form.setValue("content", v, { shouldDirty: true }),
                  editNoteImages,
                  setEditNoteImages
                )}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)} disabled={savePending} aria-label="Cancel">
              <CloseIcon />
            </Button>
            <Button type="submit" variant="contained" disabled={savePending || editNoteImages.some((i) => i.status === "processing")} aria-label={savePending ? "Saving" : "Save"}>
              {savePending ? <CircularProgress size={20} /> : <CheckIcon />}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
});
