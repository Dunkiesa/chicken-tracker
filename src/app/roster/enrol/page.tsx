"use client";

import { useState, Suspense, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import {
  Box,
  Card,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Stack,
  TextField,
  Autocomplete,
  MenuItem,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Link from "next/link";

type DynamicListEntry = {
  id: number;
  value: string;
};

const SEX_OPTIONS = ["Hen", "Rooster", "Unknown"] as const;

async function fetchDynamicListApi(type: string): Promise<DynamicListEntry[]> {
  const res = await fetch(`/api/dynamic-lists/${type}`);
  if (!res.ok) throw new Error(`Failed to fetch ${type}`);
  return res.json();
}

async function enrollChickenApi(data: {
  name: string;
  sex: string;
  breed?: string;
  origin_source?: string;
  acquisition_type?: string;
  acquisition_date?: string;
}): Promise<void> {
  const res = await fetch("/api/chickens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.message || "Failed to enroll chicken");
  }
}

function formatDateForPicker(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateForApi(date: Date | null): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const enrollSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sex: z.enum(["Hen", "Rooster", "Unknown"]),
  breed: z.string(),
  origin_source: z.string(),
  acquisition_type: z.string(),
  acquisition_date: z.string(),
});

type EnrollFormValues = z.infer<typeof enrollSchema>;

export default function EnrolPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      }
    >
      <EnrolContent />
    </Suspense>
  );
}

function EnrolContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAdmin = session?.user?.role === "Admin";

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

  const enrollMutation = useMutation({
    mutationFn: enrollChickenApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chickens"] });
      queryClient.invalidateQueries({ queryKey: ["dynamic-lists"] });
      reset();
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors: formErrors },
  } = useForm<EnrollFormValues>({
    resolver: zodResolver(enrollSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      sex: "Hen",
      breed: "",
      origin_source: "",
      acquisition_type: "",
      acquisition_date: "",
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

  const onEnrollSubmit = (data: EnrollFormValues) => {
    enrollMutation.mutate(
      {
        name: data.name,
        sex: data.sex,
        breed: data.breed || undefined,
        origin_source: data.origin_source || undefined,
        acquisition_type: data.acquisition_type || undefined,
        acquisition_date: data.acquisition_date || undefined,
      },
      {
        onSuccess: () => {
          router.push("/roster");
        },
      }
    );
  };

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

  if (!isAdmin) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary">
          You are signed in as a Viewer. Only admins can enrol chickens.
        </Typography>
        <Button component={Link} href="/roster" sx={{ mt: 2 }}>
          Back to Roster
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 600, mx: "auto", p: 2 }}>
      <Button
        component={Link}
        href="/roster"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
      >
        Back to Roster
      </Button>

      <Typography variant="h5" gutterBottom>
        Enrol Chicken
      </Typography>

      <Card sx={{ p: 2 }}>
        <Box
          component="form"
          onSubmit={handleSubmit(onEnrollSubmit)}
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Chicken name"
                  error={!!formErrors.name}
                  helperText={formErrors.name?.message}
                  fullWidth
                  size="small"
                />
              )}
            />
            <Controller
              name="sex"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Sex"
                  error={!!formErrors.sex}
                  helperText={formErrors.sex?.message}
                  sx={{ minWidth: 140 }}
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
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Controller
              name="breed"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  freeSolo
                  fullWidth
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
                      error={!!formErrors.breed}
                      helperText={formErrors.breed?.message}
                      size="small"
                    />
                  )}
                />
              )}
            />
            <Controller
              name="origin_source"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  freeSolo
                  fullWidth
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
                      error={!!formErrors.origin_source}
                      helperText={formErrors.origin_source?.message}
                      size="small"
                    />
                  )}
                />
              )}
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Controller
              name="acquisition_type"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  freeSolo
                  fullWidth
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
                      error={!!formErrors.acquisition_type}
                      helperText={formErrors.acquisition_type?.message}
                      size="small"
                    />
                  )}
                />
              )}
            />
            <Controller
              name="acquisition_date"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label="Acquisition date"
                  value={
                    field.value ? formatDateForPicker(field.value) : null
                  }
                  onChange={(date) => field.onChange(formatDateForApi(date))}
                  sx={{ maxWidth: 200 }}
                  slotProps={{
                    textField: {
                      error: !!formErrors.acquisition_date,
                      helperText: formErrors.acquisition_date?.message,
                      size: "small",
                    },
                  }}
                />
              )}
            />
          </Stack>

          {enrollMutation.isError && (
            <Alert severity="error">{enrollMutation.error.message}</Alert>
          )}

          {enrollMutation.isSuccess && (
            <Alert severity="success">Chicken enrolled successfully!</Alert>
          )}

          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              type="submit"
              variant="contained"
              disabled={enrollMutation.isPending}
              sx={{ minWidth: 140 }}
            >
              {enrollMutation.isPending ? "Adding..." : "Add Chicken"}
            </Button>
          </Box>
        </Box>
      </Card>
    </Box>
  );
}
