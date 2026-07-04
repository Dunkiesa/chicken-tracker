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
import { render, screen, waitFor } from "@testing-library/react";
import SystemStatusFooter from "@/components/SystemStatusFooter";

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe("SystemStatusFooter", () => {
  it("does not render when unauthenticated", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: "unauthenticated",
    });
    const { container } = render(<SystemStatusFooter />);
    expect(container.firstChild).toBeNull();
  });

  it("shows checking state when authenticated but health not yet loaded", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "user@test.com" } },
      status: "authenticated",
    });
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<SystemStatusFooter />);
    expect(screen.getByText("Checking system health...")).toBeInTheDocument();
  });

  it("shows healthy state on successful fetch", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "user@test.com" } },
      status: "authenticated",
    });
    const healthData = {
      status: "ok",
      database: "connected",
      timestamp: "2026-07-03T00:00:00Z",
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve(healthData),
    });
    render(<SystemStatusFooter />);
    await waitFor(() => {
      expect(screen.getByText("Healthy")).toBeInTheDocument();
    });
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "user@test.com" } },
      status: "authenticated",
    });
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));
    render(<SystemStatusFooter />);
    await waitFor(() => {
      expect(screen.getByText("API unavailable")).toBeInTheDocument();
    });
  });
});
