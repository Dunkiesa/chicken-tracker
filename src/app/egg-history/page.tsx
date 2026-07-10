"use client";

import { useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import {
  Box,
  Button,
  Card,
  Typography,
  Alert,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Skeleton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  formatDateForDisplay,
  formatDateForPicker,
  formatDateForApi,
  todayStr,
  oneMonthAgoStr,
} from "@/lib/dateUtils";

type Egg = {
  id: number;
  chicken_id: number;
  chicken_name: string;
  weight: number;
  date: string;
  recorded_by: string;
};

async function fetchEggsByRange(
  from: string,
  to: string
): Promise<Egg[]> {
  const params = new URLSearchParams();
  params.set("from", from);
  params.set("to", to);
  const res = await fetch(`/api/eggs?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch eggs");
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

export default function EggHistoryPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      }
    >
      <EggHistoryContent />
    </Suspense>
  );
}

function EggHistoryContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAdmin = session?.user?.role === "Admin";

  const [editingEggId, setEditingEggId] = useState<number | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editDate, setEditDate] = useState("");
  const [fromDate, setFromDate] = useState(oneMonthAgoStr());
  const [toDate, setToDate] = useState(todayStr());

  const {
    data: eggs,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["eggs", "history", fromDate, toDate],
    queryFn: () => fetchEggsByRange(fromDate, toDate),
    enabled: status === "authenticated" && !!fromDate && !!toDate,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { weight: number; date: string };
    }) => updateEggApi(id, data),
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

  const displayEggs = eggs ?? [];

  return (
    <Box sx={{ maxWidth: 700, mx: "auto", p: 2, overflowX: "hidden" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">Egg History</Typography>
        <Button
          variant="outlined"
          component={Link}
          href="/log-egg"
        >
          <ArrowBackIcon />
        </Button>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <DatePicker
          label="From"
          value={fromDate ? formatDateForPicker(fromDate) : null}
          onChange={(date) => setFromDate(formatDateForApi(date))}
          closeOnSelect
          slotProps={{ textField: { size: "small", fullWidth: true } }}
          sx={{ flex: 1 }}
        />
        <DatePicker
          label="To"
          value={toDate ? formatDateForPicker(toDate) : null}
          onChange={(date) => setToDate(formatDateForApi(date))}
          closeOnSelect
          slotProps={{ textField: { size: "small", fullWidth: true } }}
          sx={{ flex: 1 }}
        />
      </Stack>

      <Card sx={{ p: 2 }}>
        {isLoading ? (
          <Stack spacing={1}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" height={40} />
            ))}
          </Stack>
        ) : error ? (
          <Alert severity="error">Failed to load eggs.</Alert>
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
                    <TableCell>{formatDateForDisplay(egg.date)}</TableCell>
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
