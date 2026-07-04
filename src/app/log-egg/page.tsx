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
  FormControlLabel,
  Checkbox,
  Grid,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { HenRow } from "@/components/HenRow";

type Chicken = {
  id: number;
  name: string;
  sex: string;
  departed: boolean;
  primary_photo_id: number | null;
  primary_photo_path: string | null;
};

type Egg = {
  id: number;
  chicken_id: number;
  chicken_name: string;
  weight: number;
  date: string;
  recorded_by: string;
};

type Warning = {
  type: "duplicate_date" | "weight_out_of_range";
  message: string;
};

type BatchEntry = {
  chicken_id: number;
  weight: number;
  date: string;
};

type BatchResult = {
  eggs: Egg[];
  warnings: Warning[][];
};

const formSchema = z.object({
  date: z.string().min(1, "Date is required"),
});

type FormValues = z.infer<typeof formSchema>;

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

async function fetchChickens(): Promise<Chicken[]> {
  const res = await fetch("/api/chickens");
  if (!res.ok) throw new Error("Failed to fetch chickens");
  return res.json();
}

async function fetchEggsByDate(date: string): Promise<Egg[]> {
  const res = await fetch(`/api/eggs?date=${date}`);
  if (!res.ok) throw new Error("Failed to fetch eggs");
  return res.json();
}

async function fetchAllEggs(): Promise<Egg[]> {
  const res = await fetch("/api/eggs");
  if (!res.ok) throw new Error("Failed to fetch eggs");
  return res.json();
}

async function submitEggsBatch(entries: BatchEntry[]): Promise<BatchResult> {
  const res = await fetch("/api/eggs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entries),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || "Failed to save eggs");
  }
  return res.json();
}

async function updateEggApi(
  id: number,
  data: { weight: number; date: string }
): Promise<Egg> {
  const res = await fetch(`/api/eggs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const result = await res.json();
    throw new Error(result.message || "Failed to update egg");
  }
  return res.json();
}

async function deleteEggApi(id: number): Promise<void> {
  const res = await fetch(`/api/eggs/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || "Failed to delete egg");
  }
}

function validateWeight(value: string): string | undefined {
  if (!value) return undefined;
  const num = parseFloat(value);
  if (isNaN(num)) return "Must be a number";
  if (num < 20 || num > 200) return "Weight must be 20-200g";
  return undefined;
}

export default function LogEggPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      }
    >
      <LogEggContent />
    </Suspense>
  );
}

function LogEggContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAdmin = session?.user?.role === "Admin";

  const [showAll, setShowAll] = useState(false);
  const [weights, setWeights] = useState<Record<number, string>>({});
  const [weightErrors, setWeightErrors] = useState<Record<number, string>>({});
  const [editingEggId, setEditingEggId] = useState<number | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editDate, setEditDate] = useState("");

  const {
    control,
    watch,
    formState: { errors: formErrors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: { date: todayStr() },
  });

  const batchDate = watch("date");

  const {
    data: allChickens,
    isLoading: hensLoading,
    error: hensError,
  } = useQuery({
    queryKey: ["chickens"],
    queryFn: fetchChickens,
    enabled: status === "authenticated",
  });

  const {
    data: eggs,
    isLoading: eggsLoading,
    error: eggsError,
  } = useQuery({
    queryKey: ["eggs", batchDate],
    queryFn: () => fetchEggsByDate(batchDate),
    enabled: status === "authenticated" && !!batchDate,
  });

  const { data: allEggs } = useQuery({
    queryKey: ["eggs", "all"],
    queryFn: fetchAllEggs,
    enabled: status === "authenticated",
  });

  const submitMutation = useMutation({
    mutationFn: submitEggsBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eggs"] });
      setWeights({});
      setWeightErrors({});
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { weight: number; date: string } }) =>
      updateEggApi(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eggs"] });
      setEditingEggId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEggApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eggs"] });
    },
  });

  const hens = useMemo(() => {
    if (!allChickens) return [];
    return allChickens.filter(
      (c) => !c.departed && (showAll || c.sex !== "Rooster")
    );
  }, [allChickens, showAll]);

  const existingEggsMap = useMemo(() => {
    const map = new Map<number, Egg>();
    if (eggs) {
      eggs.forEach((egg) => map.set(egg.chicken_id, egg));
    }
    return map;
  }, [eggs]);

  const rowWarnings = useMemo(() => {
    if (!submitMutation.data?.warnings) return {};
    const warningMap: Record<number, Warning[]> = {};
    submitMutation.data.warnings.forEach((warns, idx) => {
      if (warns.length > 0 && submitMutation.data?.eggs[idx]) {
        const chickenId = submitMutation.data.eggs[idx].chicken_id;
        warningMap[chickenId] = warns;
      }
    });
    return warningMap;
  }, [submitMutation.data]);

  const handleWeightChange = (henId: number, value: string) => {
    setWeights((prev) => ({ ...prev, [henId]: value }));
    if (weightErrors[henId]) {
      setWeightErrors((prev) => {
        const next = { ...prev };
        delete next[henId];
        return next;
      });
    }
  };

  const handleWeightBlur = (henId: number) => {
    const value = weights[henId];
    if (value) {
      const error = validateWeight(value);
      if (error) {
        setWeightErrors((prev) => ({ ...prev, [henId]: error }));
      } else {
        setWeightErrors((prev) => {
          const next = { ...prev };
          delete next[henId];
          return next;
        });
      }
    }
  };

  const handleBulkSubmit = () => {
    const entries = hens
      .filter((h) => {
        if (existingEggsMap.has(h.id)) return false;
        const w = weights[h.id];
        if (!w) return false;
        const num = parseFloat(w);
        return !isNaN(num) && num > 0;
      })
      .map((h) => ({
        chicken_id: h.id,
        weight: Math.round(parseFloat(weights[h.id]) * 100) / 100,
        date: batchDate,
      }));

    if (entries.length === 0) {
      submitMutation.reset();
      return;
    }

    const hasErrors = Object.keys(weightErrors).length > 0;
    if (hasErrors) return;

    submitMutation.mutate(entries);
  };

  const handleEdit = (egg: Egg) => {
    setEditingEggId(egg.id);
    setEditWeight(egg.weight.toString());
    setEditDate(egg.date);
    updateMutation.reset();
    deleteMutation.reset();
  };

  const handleUpdate = () => {
    if (!editingEggId) return;
    const weight = parseFloat(editWeight);
    if (isNaN(weight) || weight <= 0) return;
    updateMutation.mutate({
      id: editingEggId,
      data: { weight: Math.round(weight * 100) / 100, date: editDate },
    });
  };

  const handleDelete = (egg: Egg) => {
    if (!confirm(`Delete egg for ${egg.chicken_name} on ${egg.date}?`)) return;
    deleteMutation.mutate(egg.id);
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

  const displayEggs = allEggs ?? [];
  const hasWeightErrors = Object.keys(weightErrors).length > 0;

  return (
    <Box sx={{ maxWidth: 700, mx: "auto", p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Log
      </Typography>

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2}>
          <Controller
            name="date"
            control={control}
            render={({ field }) => (
              <DatePicker
                label="Date"
                value={field.value ? formatDateForPicker(field.value) : null}
                onChange={(date) => field.onChange(formatDateForApi(date))}
                slotProps={{
                  textField: {
                    error: !!formErrors.date,
                    helperText: formErrors.date?.message,
                    fullWidth: true,
                  },
                }}
              />
            )}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
              />
            }
            label={`Show all chickens (including roosters) — ${hens.length} available`}
          />

          {hensLoading ? (
            <Stack spacing={1}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rectangular" height={56} />
              ))}
            </Stack>
          ) : hensError ? (
            <Alert severity="error">Failed to load hens</Alert>
          ) : hens.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={2}>
              No laying hens available
            </Typography>
          ) : (
            <Grid container spacing={1.5}>
              {hens.map((hen) => (
                <Grid item xs={12} sm={6} key={hen.id}>
                  <Card variant="outlined">
                    <Box
                      onBlur={() => handleWeightBlur(hen.id)}
                      sx={{ "&:focus-within": {} }}
                    >
                      <HenRow
                        hen={hen}
                        weight={weights[hen.id] || ""}
                        existing={existingEggsMap.get(hen.id)}
                        warning={rowWarnings[hen.id]}
                        error={weightErrors[hen.id]}
                        disabled={submitMutation.isPending}
                        onWeightChange={handleWeightChange}
                      />
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {submitMutation.isError && (
            <Alert severity="error">{submitMutation.error.message}</Alert>
          )}

          {submitMutation.isSuccess && (
            <Alert severity="success">
              Logged {submitMutation.data.eggs.length} egg(s)!
            </Alert>
          )}

          {Object.keys(rowWarnings).length > 0 && (
            <Alert severity="warning">
              {Object.entries(rowWarnings).map(([chickenId, warns]) =>
                warns
                  .filter((w) => w.type === "duplicate_date")
                  .map((w, i) => <div key={`${chickenId}-${i}`}>{w.message}</div>)
              )}
            </Alert>
          )}

          <Button
            variant="contained"
            onClick={handleBulkSubmit}
            disabled={
              submitMutation.isPending ||
              hens.length === 0 ||
              hasWeightErrors
            }
            fullWidth
            size="large"
          >
            {submitMutation.isPending ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Saving...
              </>
            ) : (
              "Log All"
            )}
          </Button>
        </Stack>
      </Card>

      <Card sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Recent Eggs
        </Typography>

        {eggsLoading ? (
          <Stack spacing={1}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" height={40} />
            ))}
          </Stack>
        ) : eggsError ? (
          <Alert severity="error">Failed to load eggs</Alert>
        ) : displayEggs.length === 0 ? (
          <Typography color="text.secondary">No eggs logged yet.</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Chicken</TableCell>
                  <TableCell align="right">Weight</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayEggs.map((egg) => (
                  <TableRow key={egg.id}>
                    <TableCell>{egg.date}</TableCell>
                    <TableCell>{egg.chicken_name}</TableCell>
                    <TableCell align="right">
                      {egg.weight.toFixed(2)}g
                    </TableCell>
                    <TableCell align="center">
                      {editingEggId === egg.id ? (
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          justifyContent="center"
                        >
                          <TextField
                            type="number"
                            size="small"
                            value={editWeight}
                            onChange={(e) => setEditWeight(e.target.value)}
                            inputProps={{
                              step: 0.01,
                              min: 0,
                              style: { width: 70, textAlign: "right" },
                            }}
                          />
                          <TextField
                            type="date"
                            size="small"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            inputProps={{ style: { width: 130 } }}
                          />
                          <IconButton
                            size="small"
                            color="success"
                            onClick={handleUpdate}
                            disabled={updateMutation.isPending}
                          >
                            <CheckIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => setEditingEggId(null)}
                          >
                            <CloseIcon />
                          </IconButton>
                        </Stack>
                      ) : (
                        (isAdmin ||
                          egg.recorded_by === session?.user?.email) && (
                          <Stack
                            direction="row"
                            spacing={0.5}
                            justifyContent="center"
                          >
                            <IconButton
                              size="small"
                              onClick={() => handleEdit(egg)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(egg)}
                              disabled={deleteMutation.isPending}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        )
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {updateMutation.isError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {updateMutation.error.message}
          </Alert>
        )}

        {deleteMutation.isError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {deleteMutation.error.message}
          </Alert>
        )}

        {updateMutation.isSuccess && (
          <Alert severity="success" sx={{ mt: 1 }}>
            Egg updated
          </Alert>
        )}

        {deleteMutation.isSuccess && (
          <Alert severity="success" sx={{ mt: 1 }}>
            Egg deleted
          </Alert>
        )}
      </Card>
    </Box>
  );
}
