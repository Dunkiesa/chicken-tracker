"use client";

import { useState, Suspense, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import {
  Box,
  Card,
  Typography,
  Button,
  Alert,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Autocomplete,
  TableSortLabel,
  Skeleton,
  MenuItem,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { ChickenTableRow } from "@/components/ChickenTableRow";

type Chicken = {
  id: number;
  name: string;
  sex: string;
  breed_name: string | null;
  origin_source_name: string | null;
  acquisition_type_name: string | null;
  departed: boolean;
  departure_date: string | null;
  departure_reason: string | null;
  primary_photo_id: number | null;
  primary_photo_path: string | null;
};

type DynamicListEntry = {
  id: number;
  value: string;
};

const SEX_OPTIONS = ["Hen", "Rooster", "Unknown"] as const;

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

async function fetchChickensApi(includeDeparted: boolean): Promise<Chicken[]> {
  const url = includeDeparted ? "/api/chickens?includeDeparted=true" : "/api/chickens";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch chickens");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

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
}): Promise<Chicken> {
  const res = await fetch("/api/chickens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.message || "Failed to enroll chicken");
  }
  return res.json();
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

const enrollSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sex: z.enum(["Hen", "Rooster", "Unknown"]),
  breed: z.string(),
  origin_source: z.string(),
  acquisition_type: z.string(),
  acquisition_date: z.string(),
});

type EnrollFormValues = z.infer<typeof enrollSchema>;

const columnHelper = createColumnHelper<Chicken>();

const columns = [
  columnHelper.display({
    id: "photo",
    header: "",
    size: 56,
  }),
  columnHelper.accessor("name", {
    header: "Name",
  }),
  columnHelper.accessor("sex", {
    header: "Sex",
  }),
  columnHelper.accessor("breed_name", {
    header: "Breed",
  }),
  columnHelper.accessor("origin_source_name", {
    header: "Origin",
  }),
  columnHelper.accessor("acquisition_type_name", {
    header: "Acquisition",
  }),
  columnHelper.accessor((row) => (row.departed ? "Departed" : "Active"), {
    id: "status",
    header: "Status",
  }),
];

export default function RosterPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      }
    >
      <RosterContent />
    </Suspense>
  );
}

function RosterContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAdmin = session?.user?.role === "Admin";

  const [includeDeparted, setIncludeDeparted] = useState(false);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const [departingChickenId, setDepartingChickenId] = useState<number | null>(
    null
  );
  const [departureDate, setDepartureDate] = useState(todayStr());
  const [departureReason, setDepartureReason] = useState("died/illness");
  const [departureOtherReason, setDepartureOtherReason] = useState("");

  const {
    data: chickens,
    isLoading: chickensLoading,
    error: chickensError,
  } = useQuery({
    queryKey: ["chickens", includeDeparted],
    queryFn: () => fetchChickensApi(includeDeparted),
    enabled: status === "authenticated",
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

  const enrollMutation = useMutation({
    mutationFn: enrollChickenApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chickens"] });
      queryClient.invalidateQueries({ queryKey: ["dynamic-lists"] });
      reset();
    },
  });

  const departMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Record<string, unknown>;
    }) => updateChickenApi(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chickens"] });
      setDepartingChickenId(null);
      setDepartureDate(todayStr());
      setDepartureReason("died/illness");
      setDepartureOtherReason("");
    },
  });

  const reinstateMutation = useMutation({
    mutationFn: (id: number) =>
      updateChickenApi(id, {
        departed: false,
        departure_date: null,
        departure_reason: null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chickens"] });
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

  const table = useReactTable({
    data: chickens ?? [],
    columns,
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const onEnrollSubmit = (data: EnrollFormValues) => {
    enrollMutation.mutate({
      name: data.name,
      sex: data.sex,
      breed: data.breed || undefined,
      origin_source: data.origin_source || undefined,
      acquisition_type: data.acquisition_type || undefined,
      acquisition_date: data.acquisition_date || undefined,
    });
  };

  const handleMarkDeparted = (chicken: Chicken) => {
    const reason =
      departureReason === "Other"
        ? departureOtherReason.trim()
        : departureReason;
    departMutation.mutate({
      id: chicken.id,
      data: {
        departed: true,
        departure_date: departureDate,
        departure_reason: reason || "Other",
      },
    });
  };

  const handleReinstate = (chicken: Chicken) => {
    reinstateMutation.mutate(chicken.id);
  };

  const handleStartDepart = (chicken: Chicken) => {
    if (
      departingChickenId !== null &&
      departingChickenId !== chicken.id
    ) {
      if (!confirm("Discard unsaved departure details?")) return;
    }
    setDepartingChickenId(chicken.id);
    setDepartureDate(todayStr());
    setDepartureReason("died/illness");
    setDepartureOtherReason("");
  };

  const handleCancelDepart = () => {
    setDepartingChickenId(null);
    setDepartureDate(todayStr());
    setDepartureReason("died/illness");
    setDepartureOtherReason("");
  };

  const handleDepartureReasonChange = (value: string) => {
    setDepartureReason(value);
    if (value !== "Other") {
      setDepartureOtherReason("");
    }
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

  const departingSave =
    departMutation.isPending || reinstateMutation.isPending;

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Roster
      </Typography>

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2}>
          {isAdmin && (
            <Box
              component="form"
              onSubmit={handleSubmit(onEnrollSubmit)}
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                p: 2,
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
              }}
            >
              <Typography variant="subtitle1" fontWeight={600}>
                Enroll New Chicken
              </Typography>

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
                      options={breedOptions}
                      value={field.value || ""}
                      onChange={(_, newValue) =>
                        field.onChange(newValue || "")
                      }
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
                      options={originOptions}
                      value={field.value || ""}
                      onChange={(_, newValue) =>
                        field.onChange(newValue || "")
                      }
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
                      options={acqOptions}
                      value={field.value || ""}
                      onChange={(_, newValue) =>
                        field.onChange(newValue || "")
                      }
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
                          helperText={
                            formErrors.acquisition_type?.message
                          }
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
                        field.value
                          ? formatDateForPicker(field.value)
                          : null
                      }
                      onChange={(date) =>
                        field.onChange(formatDateForApi(date))
                      }
                      slotProps={{
                        textField: {
                          error: !!formErrors.acquisition_date,
                          helperText:
                            formErrors.acquisition_date?.message,
                          size: "small",
                          fullWidth: true,
                        },
                      }}
                    />
                  )}
                />
              </Stack>

              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={enrollMutation.isPending}
                  sx={{ minWidth: 140 }}
                >
                  {enrollMutation.isPending
                    ? "Adding..."
                    : "Add Chicken"}
                </Button>
              </Box>
            </Box>
          )}

          {isAdmin && enrollMutation.isError && (
            <Alert severity="error">{enrollMutation.error.message}</Alert>
          )}

          {isAdmin && enrollMutation.isSuccess && (
            <Alert severity="success">Chicken enrolled successfully!</Alert>
          )}

          {!isAdmin && session?.user && (
            <Typography color="text.secondary" variant="body2">
              You are signed in as a Viewer. Only admins can add chickens.
            </Typography>
          )}

          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            flexWrap="wrap"
          >
            <TextField
              placeholder="Search chickens..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              sx={{ minWidth: 220 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <SearchIcon
                      sx={{ mr: 1, color: "text.secondary", fontSize: 20 }}
                    />
                  ),
                },
              }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeDeparted}
                  onChange={(e) => setIncludeDeparted(e.target.checked)}
                  size="small"
                />
              }
              label="Show departed"
            />
          </Stack>

          {chickensLoading ? (
            <Stack spacing={1}>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} variant="rectangular" height={48} />
              ))}
            </Stack>
          ) : chickensError ? (
            <Alert severity="error">Failed to load chickens</Alert>
          ) : table.getRowModel().rows.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={3}>
              {includeDeparted
                ? "No chickens enrolled yet."
                : "No active chickens enrolled yet."}
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableCell key={header.id}>
                          {header.isPlaceholder ? null : (
                            <TableSortLabel
                              active={header.column.getIsSorted() !== false}
                              direction={
                                header.column.getIsSorted() === "asc"
                                  ? "asc"
                                  : header.column.getIsSorted() === "desc"
                                    ? "desc"
                                    : undefined
                              }
                              onClick={header.column.getToggleSortingHandler()}
                              sx={{
                                fontWeight: 600,
                                fontSize: "0.875rem",
                              }}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                            </TableSortLabel>
                          )}
                        </TableCell>
                      ))}
                      {isAdmin && (
                        <TableCell
                          sx={{
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            textAlign: "center",
                          }}
                        >
                          Actions
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableHead>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <ChickenTableRow
                      key={row.original.id}
                      chicken={row.original}
                      isAdmin={isAdmin}
                      departingChickenId={departingChickenId}
                      departureDate={departureDate}
                      departureReason={departureReason}
                      departureOtherReason={departureOtherReason}
                      departingSave={departingSave}
                      onMarkDeparted={() =>
                        handleMarkDeparted(row.original)
                      }
                      onReinstate={() => handleReinstate(row.original)}
                      onStartDepart={() =>
                        handleStartDepart(row.original)
                      }
                      onCancelDepart={handleCancelDepart}
                      onDepartureDateChange={setDepartureDate}
                      onDepartureReasonChange={handleDepartureReasonChange}
                      onDepartureOtherReasonChange={
                        setDepartureOtherReason
                      }
                    />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {departMutation.isError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {departMutation.error.message}
            </Alert>
          )}

          {reinstateMutation.isError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {reinstateMutation.error.message}
            </Alert>
          )}
        </Stack>
      </Card>
    </Box>
  );
}
