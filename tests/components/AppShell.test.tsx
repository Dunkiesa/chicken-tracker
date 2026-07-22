jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
  })),
  useParams: jest.fn(() => ({})),
  usePathname: jest.fn(() => "/"),
}));

jest.mock("@mui/material", () => ({
  ...jest.requireActual("@mui/material"),
  useMediaQuery: jest.fn(() => true),
}));

import { useSession } from "next-auth/react";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./test-utils";
import AppShell from "@/components/AppShell";
import { useMediaQuery } from "@mui/material";

beforeEach(() => {
  jest.clearAllMocks();
  const { usePathname } = require("next/navigation");
  (usePathname as jest.Mock).mockReturnValue("/");
  global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
  (useMediaQuery as jest.Mock).mockReturnValue(true);
});

describe("AppShell", () => {
  it("renders the page title regardless of auth state", () => {
    const { usePathname } = require("next/navigation");
    (usePathname as jest.Mock).mockReturnValue("/roster");
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: "unauthenticated",
    });
    renderWithProviders(<AppShell>child</AppShell>);
    expect(screen.getByText("Roster")).toBeInTheDocument();
  });

  it("shows nav items and user menu when authenticated", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "admin@test.com", role: "Admin" } },
      status: "authenticated",
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "ok",
          database: "connected",
          timestamp: new Date().toISOString(),
        }),
    });
    renderWithProviders(<AppShell>child</AppShell>);
    await waitFor(() => {
      expect(screen.getByLabelText("Dashboard")).toBeInTheDocument();
      expect(screen.getByLabelText("Roster")).toBeInTheDocument();
      expect(screen.getByLabelText("Log Egg")).toBeInTheDocument();
      expect(screen.getByLabelText("Admin")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("user menu")).toBeInTheDocument();
  });

  it("does not show nav items or user menu when unauthenticated", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: "unauthenticated",
    });
    renderWithProviders(<AppShell>child</AppShell>);
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Roster")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("user menu")).not.toBeInTheDocument();
  });

  it("shows health indicator when authenticated", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "admin@test.com", role: "Admin" } },
      status: "authenticated",
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "ok",
          database: "connected",
          timestamp: new Date().toISOString(),
        }),
    });
    renderWithProviders(<AppShell>child</AppShell>);
    await waitFor(() => {
      expect(screen.getByLabelText("system health")).toBeInTheDocument();
    });
  });

  it("shows theme toggle when authenticated", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "admin@test.com", role: "Admin" } },
      status: "authenticated",
    });
    renderWithProviders(<AppShell>child</AppShell>);
    expect(screen.getByLabelText("theme toggle")).toBeInTheDocument();
  });
});
