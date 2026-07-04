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
import { render, screen, fireEvent } from "@testing-library/react";
import UserMenu from "@/components/UserMenu";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("UserMenu", () => {
  it("shows user email and role when closed", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "user@test.com", role: "Viewer" } },
      status: "authenticated",
    });
    render(<UserMenu />);
    expect(screen.getByText("user@test.com")).toBeInTheDocument();
    expect(screen.getByText("Viewer")).toBeInTheDocument();
    expect(screen.queryByText("Sign Out")).not.toBeInTheDocument();
  });

  it("opens dropdown on click", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "user@test.com", role: "Viewer" } },
      status: "authenticated",
    });
    render(<UserMenu />);
    fireEvent.click(screen.getByText("user@test.com"));
    expect(screen.getByText("Sign Out")).toBeInTheDocument();
  });

  it("closes dropdown on outside click", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "user@test.com", role: "Viewer" } },
      status: "authenticated",
    });
    const { container } = render(<UserMenu />);
    fireEvent.click(screen.getByText("user@test.com"));
    expect(screen.getByText("Sign Out")).toBeInTheDocument();
    fireEvent.mouseDown(container);
    expect(screen.queryByText("Sign Out")).not.toBeInTheDocument();
  });

  it("shows correct role badge color for Admin vs Viewer", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "admin@test.com", role: "Admin" } },
      status: "authenticated",
    });
    const { unmount } = render(<UserMenu />);
    const adminBadge = screen.getByText("Admin");
    expect(adminBadge).toHaveStyle("background: #e3f2fd");
    expect(adminBadge).toHaveStyle("color: #1565c0");
    unmount();

    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "viewer@test.com", role: "Viewer" } },
      status: "authenticated",
    });
    render(<UserMenu />);
    const viewerBadge = screen.getByText("Viewer");
    expect(viewerBadge).toHaveStyle("background: #f3e5f5");
    expect(viewerBadge).toHaveStyle("color: #7b1fa2");
  });
});
