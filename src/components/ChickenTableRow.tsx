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
  Link as MuiLink,
} from "@mui/material";

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

const sexBadgeColors: Record<string, { bg: string; color: string }> = {
  Hen: { bg: "#fce4ec", color: "#c62828" },
  Rooster: { bg: "#e3f2fd", color: "#1565c0" },
};
const defaultSexBadgeColors = { bg: "#f3e5f5", color: "#7b1fa2" };

function ChickenTableRowInner({
  chicken,
  isAdmin,
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
  const sexColors = sexBadgeColors[chicken.sex] ?? defaultSexBadgeColors;

  return (
    <TableRow
      sx={{
        "&:last-child td, &:last-child th": { border: 0 },
        bgcolor: chicken.departed ? "action.hover" : "transparent",
      }}
    >
      <TableCell sx={{ py: 1, pl: 0, width: 56 }}>
        <Avatar
          src={chicken.primary_photo_path ? `/api/photos/${chicken.primary_photo_path}` : undefined}
          alt=""
          sx={{
            width: 36,
            height: 36,
            bgcolor: "action.disabledBackground",
          }}
        />
      </TableCell>
      <TableCell sx={{ py: 1, fontWeight: 500 }}>
        <MuiLink href={`/chickens/${chicken.id}`} underline="none" color="primary">
          {chicken.name}
        </MuiLink>
      </TableCell>
      <TableCell sx={{ py: 1 }}>
        <Chip
          label={chicken.sex}
          size="small"
          sx={{
            bgcolor: sexColors.bg,
            color: sexColors.color,
            fontWeight: 600,
            fontSize: "0.8rem",
          }}
        />
      </TableCell>

      <TableCell sx={{ py: 1 }}>
        <Chip
          label={chicken.departed ? "Departed" : "Active"}
          size="small"
          sx={{
            bgcolor: chicken.departed ? "#ffebee" : "#e8f5e9",
            color: chicken.departed ? "#b71c1c" : "#2e7d32",
            fontWeight: 600,
            fontSize: "0.8rem",
          }}
        />
        {chicken.departed && chicken.departure_date && (
          <Typography variant="caption" display="block" color="text.disabled" sx={{ mt: 0.5 }}>
            {chicken.departure_date}
            {chicken.departure_reason && ` \u00b7 ${chicken.departure_reason}`}
          </Typography>
        )}
      </TableCell>
      {isAdmin && (
        <TableCell sx={{ py: 1, textAlign: "center" }}>
          {departingChickenId === chicken.id ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
                p: 1.5,
                border: 1,
                borderColor: "divider",
                borderRadius: 1.5,
                bgcolor: "action.disabledBackground",
                minWidth: 220,
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
          ) : chicken.departed ? (
            <Button
              variant="outlined"
              size="small"
              onClick={onReinstate}
              sx={{
                color: "success.main",
                borderColor: "success.light",
                fontSize: "0.75rem",
              }}
            >
              Reinstate
            </Button>
          ) : (
            <Button
              variant="outlined"
              size="small"
              onClick={onStartDepart}
              color="error"
              sx={{ fontSize: "0.75rem" }}
            >
              Mark Departed
            </Button>
          )}
        </TableCell>
      )}
    </TableRow>
  );
}

export const ChickenTableRow = memo(ChickenTableRowInner);
