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
import AppShell from "@/components/AppShell";

beforeEach(() => {
  jest.clearAllMocks();
});

beforeAll(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "ok",
          database: "connected",
          timestamp: new Date().toISOString(),
        }),
    }),
  ) as jest.Mock;
});

describe("AppShell", () => {
  it("renders the ChickenTrack title regardless of auth state", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: "unauthenticated",
    });
    render(<AppShell>child</AppShell>);
    expect(screen.getByText("ChickenTrack")).toBeInTheDocument();
  });

  it("shows NavMenu and UserMenu when authenticated", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "admin@test.com", role: "Admin" } },
      status: "authenticated",
    });
    render(<AppShell>child</AppShell>);
    expect(screen.getByText("Log")).toBeInTheDocument();
    expect(screen.getByText("Roster")).toBeInTheDocument();
    expect(screen.getByText("admin@test.com")).toBeInTheDocument();
  });

  it("does not show NavMenu or UserMenu when unauthenticated", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: "unauthenticated",
    });
    render(<AppShell>child</AppShell>);
    expect(screen.queryByText("Log")).not.toBeInTheDocument();
    expect(screen.queryByText("Roster")).not.toBeInTheDocument();
    expect(screen.queryByText("admin@test.com")).not.toBeInTheDocument();
  });

  it("renders SystemStatusFooter when authenticated", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "admin@test.com", role: "Admin" } },
      status: "authenticated",
    });
    render(<AppShell>child</AppShell>);
    await waitFor(() => {
      expect(screen.getByText("Healthy")).toBeInTheDocument();
    });
  });
});
