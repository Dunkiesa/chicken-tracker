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

import { useSession, signOut } from "next-auth/react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./test-utils";
import UserMenu from "@/components/UserMenu";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("UserMenu", () => {
  it("shows user menu button", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "user@test.com", role: "Viewer" } },
      status: "authenticated",
    });
    renderWithProviders(<UserMenu />);
    expect(screen.getByLabelText("user menu")).toBeInTheDocument();
  });

  it("opens menu on click and shows user info", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "user@test.com", role: "Viewer" } },
      status: "authenticated",
    });
    renderWithProviders(<UserMenu />);
    fireEvent.click(screen.getByLabelText("user menu"));
    await waitFor(() => {
      expect(screen.getByText("user@test.com")).toBeInTheDocument();
      expect(screen.getByText("Viewer")).toBeInTheDocument();
    });
  });

  it("shows sign out option in menu", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "user@test.com", role: "Viewer" } },
      status: "authenticated",
    });
    renderWithProviders(<UserMenu />);
    fireEvent.click(screen.getByLabelText("user menu"));
    await waitFor(() => {
      expect(screen.getByText("Sign Out")).toBeInTheDocument();
    });
  });

  it("calls signOut when sign out is clicked", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "user@test.com", role: "Viewer" } },
      status: "authenticated",
    });
    renderWithProviders(<UserMenu />);
    fireEvent.click(screen.getByLabelText("user menu"));
    await waitFor(() => {
      expect(screen.getByText("Sign Out")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Sign Out"));
    expect(signOut).toHaveBeenCalled();
  });
});
