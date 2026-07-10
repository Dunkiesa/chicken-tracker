"use client";
import { memo } from "react";
import {
  TableRow,
  TableCell,
  Avatar,
  Chip,
  TextField,
  MenuItem,
  Button,
  Box,
  Typography,
  Stack,
  Link as MuiLink,
} from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { formatDateForDisplay } from "@/lib/dateUtils";

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

const DEPARTURE_REASONS = ["died/illness", "sold", "predator", "gave away", "Other"] as const;

type ChickenTableRowProps = {
  chicken: Chicken;
  isAdmin: boolean;
  isMobile?: boolean;
  departingChickenId: number | null;
  departureDate: string;
  departureReason: string;
  departureOtherReason: string;
  departingSave: boolean;
  onMarkDeparted: () => void;
  onReinstate: () => void;
  onStartDepart: () => void;
  onCancelDepart: () => void;
  onDepartureDateChange: (value: string) => void;
  onDepartureReasonChange: (value: string) => void;
  onDepartureOtherReasonChange: (value: string) => void;
};

const sexBadgeSx: Record<string, { bgcolor: string; color: string }> = {
  Hen: { bgcolor: "secondary.light", color: "secondary.dark" },
  Rooster: { bgcolor: "primary.light", color: "primary.dark" },
};
const defaultSexBadgeSx = { bgcolor: "action.disabledBackground", color: "text.secondary" };

function ChickenTableRowInner({
  chicken,
  isAdmin,
  isMobile = false,
  departingChickenId,
  departureDate,
  departureReason,
  departureOtherReason,
  departingSave,
  onMarkDeparted,
  onReinstate,
  onStartDepart,
  onCancelDepart,
  onDepartureDateChange,
  onDepartureReasonChange,
  onDepartureOtherReasonChange,
}: ChickenTableRowProps) {
  const sexSx = sexBadgeSx[chicken.sex] ?? defaultSexBadgeSx;

  return (
    <>
      <TableRow
        sx={{
          "&:last-child td, &:last-child th": { border: 0 },
          bgcolor: chicken.departed ? "action.hover" : "transparent",
        }}
      >
        <TableCell sx={{ py: { xs: 0.5, sm: 1 }, pl: 0, width: { xs: 80, sm: 100 } }}>
          <Stack alignItems="center" spacing={0.5}>
            <Avatar
              src={chicken.primary_photo_path ? `/api/photos/${chicken.primary_photo_path}` : undefined}
              alt=""
              sx={{
                width: { xs: 28, sm: 36 },
                height: { xs: 28, sm: 36 },
                bgcolor: "action.disabledBackground",
              }}
            />
            <Chip
              label={chicken.sex}
              size="small"
              sx={{
                bgcolor: sexSx.bgcolor,
                color: sexSx.color,
                fontWeight: 600,
                fontSize: "0.65rem",
                height: 18,
                "& .MuiChip-label": { px: 0.75 },
              }}
            />
          </Stack>
        </TableCell>
        <TableCell sx={{ py: { xs: 0.5, sm: 1 }, fontWeight: 500 }}>
          <MuiLink href={`/chickens/${chicken.id}`} underline="none" color="primary">
            {chicken.name}
          </MuiLink>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.25, justifyContent: "space-between" }}>
            <Box>
              <Chip
                label={chicken.departed ? "Departed" : "Active"}
                size="small"
                sx={{
                  bgcolor: chicken.departed ? "error.light" : "success.light",
                  color: chicken.departed ? "error.dark" : "success.dark",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                }}
              />
              {chicken.departed && chicken.departure_date && (
                <Typography variant="caption" display="block" color="text.disabled" sx={{ mt: 0.5 }}>
                  {formatDateForDisplay(chicken.departure_date)}
                  {chicken.departure_reason && ` \u00b7 ${chicken.departure_reason}`}
                </Typography>
              )}
            </Box>
            {isAdmin && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  if (chicken.departed) {
                    if (confirm("Reinstate this chicken?")) {
                      onReinstate();
                    }
                  } else {
                    onStartDepart();
                  }
                }}
                sx={{ flexShrink: 0, minWidth: 0, px: 0.75, fontSize: "0.7rem" }}
              >
                <SwapHorizIcon sx={{ fontSize: 18 }} />
              </Button>
            )}
          </Stack>
        </TableCell>
      </TableRow>
      {isAdmin && departingChickenId === chicken.id && (
        <TableRow>
          <TableCell colSpan={2} sx={{ py: 1, pl: 0 }}>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
                p: { xs: 1, sm: 1.5 },
                border: 1,
                borderColor: "divider",
                borderRadius: 1.5,
                bgcolor: "action.disabledBackground",
                maxWidth: 320,
              }}
            >
              <TextField
                type="date"
                size="small"
                value={departureDate}
                onChange={(e) => onDepartureDateChange(e.target.value)}
                disabled={departingSave}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                select
                size="small"
                value={departureReason}
                onChange={(e) => onDepartureReasonChange(e.target.value)}
                disabled={departingSave}
              >
                {DEPARTURE_REASONS.map((r) => (
                  <MenuItem key={r} value={r}>
                    {r}
                  </MenuItem>
                ))}
              </TextField>
              {departureReason === "Other" && (
                <TextField
                  size="small"
                  value={departureOtherReason}
                  onChange={(e) => onDepartureOtherReasonChange(e.target.value)}
                  placeholder="Describe reason..."
                  disabled={departingSave}
                />
              )}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                <Button
                  variant="contained"
                  color="error"
                  size="small"
                  onClick={onMarkDeparted}
                  disabled={departingSave || (departureReason === "Other" && !departureOtherReason.trim())}
                >
                  {departingSave ? "Saving..." : "Confirm"}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={onCancelDepart}
                  disabled={departingSave}
                >
                  Cancel
                </Button>
              </Box>
            </Box>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export const ChickenTableRow = memo(ChickenTableRowInner);
