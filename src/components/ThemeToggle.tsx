"use client";

import { useRef, useState } from "react";
import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Divider,
  Box,
} from "@mui/material";
import { useThemeMode } from "@/theme";

const options = [
  { value: "system" as const, label: "System", icon: BrightnessAutoIcon },
  { value: "light" as const, label: "Light", icon: LightModeIcon },
  { value: "dark" as const, label: "Dark", icon: DarkModeIcon },
];

export default function ThemeToggle() {
  const { mode, setMode, sourceColor, setSourceColor } = useThemeMode();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (value: "system" | "light" | "dark") => {
    setMode(value);
    handleClose();
  };

  const handlePaletteClick = () => {
    handleClose();
    const input = colorInputRef.current;
    if (input) {
      input.value = sourceColor;
      input.click();
    }
  };

  const CurrentIcon = options.find((o) => o.value === mode)?.icon ?? BrightnessAutoIcon;

  return (
    <>
      <Tooltip title="Theme">
        <IconButton
          size="large"
          color="inherit"
          onClick={handleClick}
          aria-label="theme toggle"
          aria-controls={open ? "theme-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={open ? "true" : undefined}
        >
          <CurrentIcon />
        </IconButton>
      </Tooltip>
      <Menu
        id="theme-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{ "aria-label": "theme options" }}
      >
        {options.map(({ value, label, icon: Icon }) => (
          <MenuItem
            key={value}
            selected={mode === value}
            onClick={() => handleSelect(value)}
          >
            <ListItemIcon>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={handlePaletteClick}>
          <ListItemIcon>
            <Box
              sx={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                backgroundColor: sourceColor,
                border: "1px solid",
                borderColor: "divider",
              }}
            />
          </ListItemIcon>
          <ListItemText>Palette color</ListItemText>
        </MenuItem>
      </Menu>
      <Box
        component="input"
        type="color"
        ref={colorInputRef}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setSourceColor(e.target.value)
        }
        sx={{ display: "none" }}
        aria-label="select palette color"
      />
    </>
  );
}
