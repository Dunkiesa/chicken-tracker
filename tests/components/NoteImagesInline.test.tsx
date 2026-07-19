jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  useParams: jest.fn(() => ({})),
  usePathname: jest.fn(() => "/"),
}));

import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "./test-utils";
import NoteImagesInline from "@/components/NoteImagesInline";
import type { NoteImageForDisplay } from "@/components/NoteImagesInline";

beforeEach(() => {
  jest.clearAllMocks();
});

const sampleImages: NoteImageForDisplay[] = [
  { id: 1, file_path: "notes/a.jpg", thumbnail_path: "notes/a_thumb.jpg" },
  { id: 2, file_path: "notes/b.jpg", thumbnail_path: null },
];

describe("NoteImagesInline", () => {
  it("renders nothing when images array is empty", () => {
    const { container } = renderWithProviders(
      <NoteImagesInline images={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a thumbnail for each image", () => {
    renderWithProviders(<NoteImagesInline images={sampleImages} />);
    const imgs = screen.getAllByRole("img");
    expect(imgs).toHaveLength(2);
  });

  it("uses thumbnail_path when available, falls back to file_path", () => {
    renderWithProviders(<NoteImagesInline images={sampleImages} />);
    const imgs = screen.getAllByRole("img");
    expect(imgs[0]!.getAttribute("src")).toBe("/api/notes/images/a_thumb.jpg");
    expect(imgs[1]!.getAttribute("src")).toBe("/api/notes/images/b.jpg");
  });

  it("opens a lightbox dialog when a thumbnail is clicked", () => {
    renderWithProviders(<NoteImagesInline images={sampleImages} />);
    const imgs = screen.getAllByRole("img");
    fireEvent.click(imgs[0]!);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    const lightboxImg = dialog.querySelector("img");
    expect(lightboxImg).toBeTruthy();
    expect(lightboxImg!.getAttribute("src")).toContain("a.jpg");
  });

  it("closes the lightbox when the close button is clicked", () => {
    renderWithProviders(<NoteImagesInline images={sampleImages} />);
    const imgs = screen.getAllByRole("img");
    fireEvent.click(imgs[0]!);

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
