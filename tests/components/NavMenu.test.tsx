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
import { render, screen } from "@testing-library/react";
import NavMenu from "@/components/NavMenu";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("NavMenu", () => {
  it("shows Log and Roster links for viewers", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "viewer@test.com", role: "Viewer" } },
      status: "authenticated",
    });
    render(<NavMenu />);
    expect(screen.getByText("Log")).toBeInTheDocument();
    expect(screen.getByText("Roster")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("shows Dashboard and Admin links for admins", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "admin@test.com", role: "Admin" } },
      status: "authenticated",
    });
    render(<NavMenu />);
    expect(screen.getByText("Log")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Roster")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("each link has correct href", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "admin@test.com", role: "Admin" } },
      status: "authenticated",
    });
    render(<NavMenu />);
    expect(screen.getByText("Log").closest("a")).toHaveAttribute("href", "/log-egg");
    expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute("href", "/");
    expect(screen.getByText("Roster").closest("a")).toHaveAttribute("href", "/roster");
    expect(screen.getByText("Admin").closest("a")).toHaveAttribute("href", "/admin");
  });
});
