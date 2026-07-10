"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
  Skeleton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { formatDateForDisplay } from "@/lib/dateUtils";

type Egg = {
  id: number;
  chicken_id: number;
  chicken_name: string;
  weight: number;
  date: string;
  recorded_by: string;
};

async function fetchChickenEggs(
  chicken_id: number,
  from: string,
  to: string
): Promise<Egg[]> {
  const params = new URLSearchParams();
  params.set("chicken_id", String(chicken_id));
  params.set("from", from);
  params.set("to", to);
  const res = await fetch(`/api/eggs?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch eggs");
  return res.json();
}

export default function ChickenEggsPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      }
    >
      <ChickenEggsContent />
    </Suspense>
  );
}

function ChickenEggsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const chickenIdStr = searchParams.get("chicken_id");
  const chickenName = searchParams.get("chicken_name") || "Chicken";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const chickenId = chickenIdStr ? parseInt(chickenIdStr, 10) : null;

  const {
    data: eggs,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["eggs", "chicken", chickenId, from, to],
    queryFn: () => fetchChickenEggs(chickenId!, from, to),
    enabled: chickenId !== null && !!from && !!to,
  });

  const displayEggs = eggs ?? [];

  return (
    <Box sx={{ maxWidth: 700, mx: "auto", p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">
          {chickenName}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => router.push(`/?from=${from}&to=${to}`)}
        >
          <ArrowBackIcon />
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {from} to {to}
      </Typography>

      <Card sx={{ p: 2 }}>
        {isLoading ? (
          <Stack spacing={1}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} variant="rectangular" height={40} />
            ))}
          </Stack>
        ) : error ? (
          <Alert severity="error">Failed to load eggs.</Alert>
        ) : displayEggs.length === 0 ? (
          <Typography color="text.secondary">
            No eggs logged for this chicken in the selected period.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Weight</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayEggs.map((egg) => (
                  <TableRow key={egg.id}>
                    <TableCell>{formatDateForDisplay(egg.date)}</TableCell>
                    <TableCell align="right">
                      {egg.weight.toFixed(2)}g
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </Box>
  );
}
