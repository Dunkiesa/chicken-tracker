"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useTheme } from "@mui/material/styles";
import { useMediaQuery } from "@mui/material";
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

const PAGE_TITLES: { prefix: string; title: string }[] = [
  { prefix: "/log-egg", title: "Log Egg" },
  { prefix: "/roster", title: "Roster" },
  { prefix: "/chickens", title: "Roster" },
  { prefix: "/dashboard", title: "Dashboard" },
  { prefix: "/gallery", title: "Gallery" },
  { prefix: "/admin", title: "Admin" },
  { prefix: "/egg-history", title: "Egg History" },
];

function usePageTitle(): string | null {
  const pathname = usePathname();
  const match = PAGE_TITLES.find((p) => pathname.startsWith(p.prefix));
  return match?.title ?? null;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [drawerHovered, setDrawerHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pageTitle = usePageTitle();

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
          {pageTitle && (
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 500 }}>
              {pageTitle}
            </Typography>
          )}
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
          slotProps={{ root: { keepMounted: true } }}
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
          minHeight: "100dvh",
          maxWidth: "100%",
          bgcolor: "background.default",
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
