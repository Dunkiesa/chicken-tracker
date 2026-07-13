"use client";

import { useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
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
  TableContainer,
  TextField,
  Skeleton,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import Link from "next/link";
import { ChickenTableRow } from "@/components/ChickenTableRow";
import { todayStr } from "@/lib/dateUtils";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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
  primary_thumbnail_path: string | null;
};

async function fetchChickensApi(includeDeparted: boolean): Promise<Chicken[]> {
  const url = includeDeparted ? "/api/chickens?includeDeparted=true" : "/api/chickens";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch chickens");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
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

const columnHelper = createColumnHelper<Chicken>();

const columns = [
  columnHelper.display({
    id: "photo",
    header: "",
    size: 100,
  }),
  columnHelper.accessor("name", {
    header: "Name",
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [includeDeparted, setIncludeDeparted] = useState(false);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const [departingChickenId, setDepartingChickenId] = useState<number | null>(
    null
  );
  const [departureDate, setDepartureDate] = useState(todayStr());
  const [departureReason, setDepartureReason] = useState("died/illness");
  const [departureOtherReason, setDepartureOtherReason] = useState("");
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [discardTargetChicken, setDiscardTargetChicken] = useState<number | null>(null);

  const {
    data: chickens,
    isLoading: chickensLoading,
    error: chickensError,
  } = useQuery({
    queryKey: ["chickens", includeDeparted],
    queryFn: () => fetchChickensApi(includeDeparted),
    enabled: status === "authenticated",
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
      setDiscardTargetChicken(chicken.id);
      setDiscardDialogOpen(true);
      return;
    }
    startDepartingChicken(chicken.id);
  };

  const startDepartingChicken = (chickenId: number) => {
    setDepartingChickenId(chickenId);
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
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Typography variant="h5">Roster</Typography>
        {isAdmin && (
          <Button
            component={Link}
            href="/roster/enrol"
            variant="outlined"
            aria-label="Enrol Chicken"
            sx={{ minWidth: 0, p: 1, width: 40, height: 40 }}
          >
            <AddIcon />
          </Button>
        )}
      </Stack>

      <Card sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={{ xs: 1, sm: 2 }}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <TextField
              placeholder="Search chickens..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              fullWidth={isMobile}
              sx={isMobile ? undefined : { minWidth: 220 }}
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
              <Table size="small" sx={{ tableLayout: "fixed" }}>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <ChickenTableRow
                      key={row.original.id}
                      chicken={row.original}
                      isAdmin={isAdmin}
                      isMobile={isMobile}
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
            <Alert severity="error">
              {departMutation.error.message}
            </Alert>
          )}

          {reinstateMutation.isError && (
            <Alert severity="error">
              {reinstateMutation.error.message}
            </Alert>
          )}
        </Stack>
      </Card>

      <ConfirmDialog
        open={discardDialogOpen}
        title="Discard Departure"
        message="Discard unsaved departure details?"
        confirmLabel="Discard"
        onConfirm={() => {
          setDiscardDialogOpen(false);
          if (discardTargetChicken !== null) {
            startDepartingChicken(discardTargetChicken);
          }
          setDiscardTargetChicken(null);
        }}
        onCancel={() => {
          setDiscardDialogOpen(false);
          setDiscardTargetChicken(null);
        }}
      />
    </Box>
  );
}
