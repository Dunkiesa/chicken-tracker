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
  usePathname: jest.fn(() => "/log-egg"),
}));

import { useSession } from "next-auth/react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "./test-utils";
import LogEggPage from "@/app/log-egg/page";

const mockChickens = [
  {
    id: 1,
    name: "Henrietta",
    sex: "Hen",
    departed: false,
    primary_photo_id: null,
    primary_photo_path: null,
    primary_thumbnail_path: null,
  },
  {
    id: 2,
    name: "Foghorn",
    sex: "Rooster",
    departed: false,
    primary_photo_id: null,
    primary_photo_path: null,
    primary_thumbnail_path: null,
  },
  {
    id: 3,
    name: "Mystery",
    sex: "Unknown",
    departed: false,
    primary_photo_id: null,
    primary_photo_path: null,
    primary_thumbnail_path: null,
  },
  {
    id: 4,
    name: "Departed Hen",
    sex: "Hen",
    departed: true,
    primary_photo_id: null,
    primary_photo_path: null,
    primary_thumbnail_path: null,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  (useSession as jest.Mock).mockReturnValue({
    data: { user: { email: "user@test.com", role: "Viewer" } },
    status: "authenticated",
  });
  global.fetch = jest.fn((url: string) => {
    if (typeof url === "string" && url === "/api/chickens") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockChickens),
      });
    }
    if (typeof url === "string" && url.startsWith("/api/eggs")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    }
    return new Promise(() => {});
  }) as jest.Mock;
});

describe("LogEggPage hen filter", () => {
  it("only includes active hens by default and includes all active chickens when show all is checked", async () => {
    renderWithProviders(<LogEggPage />);

    // Wait for chickens to load
    await waitFor(() => {
      expect(screen.getByText("Henrietta")).toBeInTheDocument();
    });

    // By default, Rooster, Unknown, and departed chickens should NOT be shown
    expect(screen.queryByText("Foghorn")).not.toBeInTheDocument();
    expect(screen.queryByText("Mystery")).not.toBeInTheDocument();
    expect(screen.queryByText("Departed Hen")).not.toBeInTheDocument();

    // Find the Show All checkbox
    const showAllCheckbox = screen.getByRole("checkbox", { name: /show all/i });
    expect(showAllCheckbox).not.toBeChecked();

    // Check Show All
    fireEvent.click(showAllCheckbox);
    expect(showAllCheckbox).toBeChecked();

    // Now active chickens of all sexes should appear
    expect(screen.getByText("Henrietta")).toBeInTheDocument();
    expect(screen.getByText("Foghorn")).toBeInTheDocument();
    expect(screen.getByText("Mystery")).toBeInTheDocument();
    // Departed chicken should still NOT be shown
    expect(screen.queryByText("Departed Hen")).not.toBeInTheDocument();

    // Uncheck Show All
    fireEvent.click(showAllCheckbox);
    expect(showAllCheckbox).not.toBeChecked();

    // Only active Hen should remain
    expect(screen.getByText("Henrietta")).toBeInTheDocument();
    expect(screen.queryByText("Foghorn")).not.toBeInTheDocument();
    expect(screen.queryByText("Mystery")).not.toBeInTheDocument();
    expect(screen.queryByText("Departed Hen")).not.toBeInTheDocument();
  });
});
