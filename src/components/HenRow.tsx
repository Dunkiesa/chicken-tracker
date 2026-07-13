"use client";
import { memo } from "react";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import CheckIcon from "@mui/icons-material/Check";

type HenRowProps = {
  hen: { id: number; name: string; primary_photo_path: string | null; primary_thumbnail_path?: string | null };
  weight: string;
  existing: { id: number; weight: number } | undefined;
  warning: { type: string; message: string }[] | undefined;
  error: string | undefined;
  disabled: boolean;
  onWeightChange: (henId: number, value: string) => void;
};

function HenRowInner({ hen, weight, existing, warning, error, disabled, onWeightChange }: HenRowProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 1.5,
        py: 0.75,
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: existing ? "action.hover" : "transparent",
      }}
    >
      <Avatar
        src={(hen.primary_thumbnail_path || hen.primary_photo_path) ? `/api/photos/${hen.primary_thumbnail_path || hen.primary_photo_path}` : undefined}
        alt=""
        sx={{
          width: 32,
          height: 32,
          bgcolor: "action.disabledBackground",
          flexShrink: 0,
        }}
      />
      <Typography
        variant="body1"
        sx={{
          flex: "1 1 100px",
          fontWeight: 500,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {hen.name}
      </Typography>
      {existing ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {existing.weight.toFixed(2)}g
          </Typography>
          <CheckIcon sx={{ color: "success.main", fontSize: 20 }} />
        </Box>
      ) : (
        <TextField
          type="number"
          size="small"
          value={weight}
          onChange={(e) => onWeightChange(hen.id, e.target.value)}
          placeholder="Weight (g)"
          disabled={disabled}
          error={!!error}
          helperText={error}
          inputProps={{
            step: 0.01,
            min: 0,
            style: { textAlign: "right" },
          }}
          sx={{
            width: 110,
            flexShrink: 0,
            "& .MuiOutlinedInput-root": {
              fontSize: "0.9rem",
            },
          }}
        />
      )}
      {warning != null && warning.length > 0 && (
        <Box
          sx={{
            maxWidth: 160,
            textAlign: "right",
            flexShrink: 0,
          }}
        >
          {warning.map((w, i) => (
            <Typography key={i} variant="caption" color="warning.main" display="block">
              {w.message}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}

export const HenRow = memo(HenRowInner);
