"use client";

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
              minHeight: 48,
              justifyContent: expanded ? "initial" : "center",
              px: expanded ? 2 : 0,
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
                minWidth: 0,
                justifyContent: "center",
                mr: expanded ? 2 : 0,
                color: active ? "inherit" : "text.secondary",
              }}
            >
              <Icon />
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              sx={{ opacity: expanded ? 1 : 0 }}
            />
          </ListItemButton>
        );

        if (!expanded) {
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
