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
import { screen } from "@testing-library/react";
import { renderWithProviders } from "./test-utils";
import NavMenu from "@/components/NavMenu";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("NavMenu", () => {
  it("shows Dashboard, Roster, and Log Egg for viewers", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "viewer@test.com", role: "Viewer" } },
      status: "authenticated",
    });
    renderWithProviders(<NavMenu expanded />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Roster")).toBeInTheDocument();
    expect(screen.getByText("Log Egg")).toBeInTheDocument();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("shows Admin link for admins", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "admin@test.com", role: "Admin" } },
      status: "authenticated",
    });
    renderWithProviders(<NavMenu expanded />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("each link has correct href", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "admin@test.com", role: "Admin" } },
      status: "authenticated",
    });
    renderWithProviders(<NavMenu expanded />);
    expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute(
      "href",
      "/dashboard"
    );
    expect(screen.getByText("Roster").closest("a")).toHaveAttribute(
      "href",
      "/roster"
    );
    expect(screen.getByText("Log Egg").closest("a")).toHaveAttribute(
      "href",
      "/log-egg"
    );
    expect(screen.getByText("Admin").closest("a")).toHaveAttribute(
      "href",
      "/admin"
    );
  });
});
