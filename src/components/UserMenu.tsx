"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import {
  IconButton,
  Menu,
  Typography,
  Chip,
  Divider,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Box,
  Tooltip,
} from "@mui/material";

export default function UserMenu() {
  const { data: session } = useSession();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const isAdmin = session?.user?.role === "Admin";

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Tooltip title="Account">
        <IconButton
          size="large"
          color="inherit"
          onClick={handleClick}
          aria-controls={open ? "user-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={open ? "true" : undefined}
          aria-label="user menu"
        >
          <AccountCircleIcon />
        </IconButton>
      </Tooltip>
      <Menu
        id="user-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{ "aria-label": "user options" }}
        slotProps={{
          paper: {
            sx: { minWidth: 220, mt: 1 },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" color="text.secondary" noWrap>
            {session?.user?.email}
          </Typography>
          <Chip
            label={session?.user?.role}
            size="small"
            color={isAdmin ? "primary" : "secondary"}
            sx={{ mt: 0.5 }}
          />
        </Box>
        <Divider />
        <MenuItem onClick={() => signOut()}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Sign Out</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
