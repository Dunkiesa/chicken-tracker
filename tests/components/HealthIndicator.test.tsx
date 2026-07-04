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

import { useSession } from "next-auth/react";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./test-utils";
import HealthIndicator from "@/components/HealthIndicator";

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe("HealthIndicator", () => {
  it("shows healthy icon when system is healthy", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "ok",
          database: "connected",
          timestamp: new Date().toISOString(),
        }),
    });
    renderWithProviders(<HealthIndicator />);
    await waitFor(() => {
      expect(screen.getByLabelText("system health")).toBeInTheDocument();
    });
  });

  it("shows unhealthy icon when system is unhealthy", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "error",
          database: "disconnected",
          timestamp: new Date().toISOString(),
        }),
    });
    renderWithProviders(<HealthIndicator />);
    await waitFor(() => {
      expect(screen.getByLabelText("system health")).toBeInTheDocument();
    });
  });

  it("shows error snackbar when health check fails", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));
    renderWithProviders(<HealthIndicator />);
    await waitFor(() => {
      expect(
        screen.getByText("Unable to reach system health check")
      ).toBeInTheDocument();
    });
  });
});
