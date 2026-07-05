"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ListAltIcon from "@mui/icons-material/ListAlt";
import EggIcon from "@mui/icons-material/Egg";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import {
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from "@mui/material";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType;
  adminOnly?: boolean;
  matchPrefix: string[];
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: DashboardIcon,
    matchPrefix: ["/"],
  },
  {
    label: "Roster",
    href: "/roster",
    icon: ListAltIcon,
    matchPrefix: ["/roster", "/chickens"],
  },
  {
    label: "Log Egg",
    href: "/log-egg",
    icon: EggIcon,
    matchPrefix: ["/log-egg"],
  },
  {
    label: "Admin",
    href: "/admin",
    icon: AdminPanelSettingsIcon,
    adminOnly: true,
    matchPrefix: ["/admin"],
  },
];

function isActive(pathname: string, prefixes: string[]): boolean {
  if (pathname === "/") return prefixes.includes("/");
  return prefixes.some((p) => p !== "/" && pathname.startsWith(p));
}

interface NavMenuProps {
  expanded?: boolean;
  onItemClick?: () => void;
}

export default function NavMenu({ expanded = false, onItemClick }: NavMenuProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isAdmin = session?.user?.role === "Admin";
  const [layoutExpanded, setLayoutExpanded] = useState(expanded);

  useEffect(() => {
    if (expanded) {
      setLayoutExpanded(true);
    } else {
      const timer = setTimeout(() => setLayoutExpanded(false), 225);
      return () => clearTimeout(timer);
    }
  }, [expanded]);

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <List component="nav" sx={{ pt: 1 }}>
      {visibleItems.map((item) => {
        const active = isActive(pathname, item.matchPrefix);
        const Icon = item.icon;
        const button = (
          <ListItemButton
            component={Link}
            href={item.href}
            selected={active}
            onClick={onItemClick}
            sx={{
              mx: 1,
              borderRadius: 2,
              mb: 0.5,
              height: 48,
              justifyContent: layoutExpanded ? "initial" : "center",
              px: layoutExpanded ? 2 : 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              position: "relative",
              "&.Mui-selected": {
                bgcolor: "primary.container",
                color: "onPrimaryContainer",
                "&:hover": {
                  bgcolor: "primary.container",
                },
                "& .MuiListItemIcon-root": {
                  color: "onPrimaryContainer",
                },
              },
            }}
          >
            <ListItemIcon
              sx={{
                ...(layoutExpanded && { minWidth: 0 }),
                justifyContent: "center",
                mr: layoutExpanded ? 2 : 0,
                color: active ? "inherit" : "text.secondary",
              }}
            >
              <Icon />
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              sx={{
                opacity: expanded ? 1 : 0,
                transition: "opacity 0.225s ease",
                ...(!layoutExpanded && {
                  position: "absolute",
                }),
              }}
            />
          </ListItemButton>
        );

        if (!layoutExpanded) {
          return (
            <ListItem key={item.href} disablePadding>
              <Tooltip title={item.label} placement="right" arrow>
                {button}
              </Tooltip>
            </ListItem>
          );
        }

        return (
          <ListItem key={item.href} disablePadding>
            {button}
          </ListItem>
        );
      })}
    </List>
  );
}
