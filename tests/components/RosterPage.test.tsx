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
import { useRouter } from "next/navigation";
import { render, screen, waitFor } from "@testing-library/react";
import RosterPage from "@/app/roster/page";

const mockChicken = {
  id: 1,
  name: "Test Hen",
  sex: "Hen",
  breed_name: "Plymouth Rock",
  origin_source_name: "Local Breeder",
  acquisition_type_name: "Purchased",
  departed: false,
  departure_date: null,
  departure_reason: null,
  primary_photo_id: null,
  primary_photo_path: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
});

describe("RosterPage", () => {
  it("shows loading state", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: "loading",
    });
    render(<RosterPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("redirects to / when unauthenticated", () => {
    const mockReplace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace, push: jest.fn() });
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: "unauthenticated",
    });
    render(<RosterPage />);
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("shows enroll form for admins", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "admin@test.com", role: "Admin" } },
      status: "authenticated",
    });
    render(<RosterPage />);
    await waitFor(() => {
      expect(screen.getByText("Add Chicken")).toBeInTheDocument();
    });
  });

  it("hides enroll form for viewers", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "viewer@test.com", role: "Viewer" } },
      status: "authenticated",
    });
    render(<RosterPage />);
    await waitFor(() => {
      expect(screen.queryByText("Add Chicken")).not.toBeInTheDocument();
    });
    expect(screen.getByText(/only admins can add/i)).toBeInTheDocument();
  });

  it("shows chicken list", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "admin@test.com", role: "Admin" } },
      status: "authenticated",
    });
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (typeof url === "string" && url.startsWith("/api/chickens")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mockChicken]),
        });
      }
      return new Promise(() => {});
    });
    render(<RosterPage />);
    await waitFor(() => {
      expect(screen.getByText("Test Hen")).toBeInTheDocument();
    });
  });
});
