"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import MenuIcon from "@mui/icons-material/Menu";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  Toolbar,
  Typography,
} from "@mui/material";
import NavMenu from "./NavMenu";
import UserMenu from "./UserMenu";
import HealthIndicator from "./HealthIndicator";
import ThemeToggle from "./ThemeToggle";

const DRAWER_COLLAPSED = 80;
const DRAWER_EXPANDED = 240;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [drawerHovered, setDrawerHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAuthenticated = status === "authenticated";
  const drawerWidth = drawerHovered ? DRAWER_EXPANDED : DRAWER_COLLAPSED;

  const handleMobileToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const handleMobileClose = () => {
    setMobileOpen(false);
  };

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          bgcolor: "surface",
          color: "onSurface",
          boxShadow: 1,
        }}
      >
        <Toolbar>
          {isAuthenticated && !isDesktop && (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="open navigation menu"
              onClick={handleMobileToggle}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            variant="h6"
            noWrap
            sx={{ fontWeight: 700, color: "primary" }}
          >
            ChickenTrack
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          {isAuthenticated && (
            <>
              <HealthIndicator />
              <ThemeToggle />
              <UserMenu />
            </>
          )}
        </Toolbar>
      </AppBar>

      {isAuthenticated && isDesktop && (
        <Drawer
          variant="permanent"
          onMouseEnter={() => setDrawerHovered(true)}
          onMouseLeave={() => setDrawerHovered(false)}
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            transition: theme.transitions.create("width"),
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              overflowX: "hidden",
              borderRight: `1px solid ${theme.palette.divider}`,
              bgcolor: "background.paper",
              transition: theme.transitions.create("width"),
            },
          }}
        >
          <Toolbar />
          <NavMenu expanded={drawerHovered} />
        </Drawer>
      )}

      {isAuthenticated && !isDesktop && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleMobileClose}
          ModalProps={{ keepMounted: true }}
          sx={{
            "& .MuiDrawer-paper": {
              width: DRAWER_EXPANDED,
              bgcolor: "background.paper",
            },
          }}
        >
          <Toolbar />
          <NavMenu expanded onItemClick={handleMobileClose} />
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: "100vh",
          bgcolor: "background.default",
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
