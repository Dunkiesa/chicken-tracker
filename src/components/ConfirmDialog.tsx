"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmIcon,
  onConfirm,
  onCancel,
  pending,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmIcon?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography>{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={pending} aria-label="Cancel">
          <CloseIcon />
        </Button>
        <Button onClick={onConfirm} variant="contained" color="error" disabled={pending} aria-label={confirmLabel}>
          {pending ? <CircularProgress size={20} /> : (confirmIcon ?? <CheckIcon />)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
