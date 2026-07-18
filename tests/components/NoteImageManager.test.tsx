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

import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "./test-utils";
import NoteImageManager from "@/components/NoteImageManager";
import type { NoteImageEntry } from "@/components/NoteImageManager";

const mockCropDialog = jest.fn();
jest.mock("@/components/CropDialog", () => ({
  __esModule: true,
  default: (props: {
    open: boolean;
    imageUrl: string;
    onCrop: (crop: { x: number; y: number; width: number; height: number }) => void;
    onCancel: () => void;
    pending: boolean;
  }) => {
    mockCropDialog(props);
    if (!props.open) return null;
    return (
      <div data-testid="crop-dialog">
        <button
          onClick={() =>
            props.onCrop({ x: 10, y: 20, width: 100, height: 100 })
          }
        >
          Confirm Crop
        </button>
        <button onClick={props.onCancel}>Cancel Crop</button>
      </div>
    );
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
});

function makeFile(name = "test.jpg"): File {
  return new File(["dummy"], name, { type: "image/jpeg" });
}

describe("NoteImageManager", () => {
  it("renders an Add image button with a file input", () => {
    const onChange = jest.fn();
    renderWithProviders(
      <NoteImageManager chickenId={1} images={[]} onChange={onChange} />
    );
    const btn = screen.getByRole("button", { name: /add image/i });
    expect(btn).toBeInTheDocument();
    const input = btn.querySelector('input[type="file"]');
    expect(input).toBeTruthy();
    expect(input?.getAttribute("accept")).toBe("image/*");
    expect(input?.getAttribute("capture")).toBe("environment");
  });

  it("uploads an image and calls onChange with the new entry", async () => {
    const onChange = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 42,
          file_path: "notes/abc.jpg",
          thumbnail_path: null,
        }),
    });

    renderWithProviders(
      <NoteImageManager chickenId={1} images={[]} onChange={onChange} />
    );

    const input = screen.getByRole("button", { name: /add image/i }).querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [makeFile()] } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/chickens/1/notes/images",
        expect.objectContaining({ method: "POST" })
      );
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([
        { id: 42, file_path: "notes/abc.jpg", crop: null },
      ]);
    });
  });

  it("disables the Add image button while an upload is in flight", async () => {
    const onChange = jest.fn();
    let resolveFetch: (v: unknown) => void;
    (global.fetch as jest.Mock).mockImplementationOnce(
      () => new Promise((r) => { resolveFetch = r; })
    );

    renderWithProviders(
      <NoteImageManager chickenId={1} images={[]} onChange={onChange} />
    );

    const input = screen.getByRole("button", { name: /add image/i }).querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [makeFile()] } });

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /add image/i });
      const input = btn.querySelector('input[type="file"]');
      expect(input).not.toBeNull();
      expect(input!).toBeDisabled();
    });

    resolveFetch!({
      ok: true,
      json: () => Promise.resolve({ id: 1, file_path: "x.jpg" }),
    });

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /add image/i });
      const input = btn.querySelector('input[type="file"]');
      expect(input).not.toBeNull();
      expect(input!).not.toBeDisabled();
    });
  });

  it("surfaces upload errors as an alert", async () => {
    const onChange = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ message: "File too large" }),
    });

    renderWithProviders(
      <NoteImageManager chickenId={1} images={[]} onChange={onChange} />
    );

    const input = screen.getByRole("button", { name: /add image/i }).querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [makeFile()] } });

    await waitFor(() => {
      expect(screen.getByText("File too large")).toBeInTheDocument();
    });
  });

  it("removes an image from the list when Remove is clicked", () => {
    const onChange = jest.fn();
    const images: NoteImageEntry[] = [
      { id: 1, file_path: "a.jpg", crop: null },
      { id: 2, file_path: "b.jpg", crop: null },
    ];

    renderWithProviders(
      <NoteImageManager chickenId={1} images={images} onChange={onChange} />
    );

    const removeButtons = screen.getAllByRole("button", { name: /remove image/i });
    expect(removeButtons).toHaveLength(2);
    fireEvent.click(removeButtons[0]!);

    expect(onChange).toHaveBeenCalledWith([
      { id: 2, file_path: "b.jpg", crop: null },
    ]);
  });

  it("opens the crop dialog when the crop button is clicked", () => {
    const onChange = jest.fn();
    const images: NoteImageEntry[] = [
      { id: 1, file_path: "a.jpg", crop: null },
    ];

    renderWithProviders(
      <NoteImageManager chickenId={1} images={images} onChange={onChange} />
    );

    const cropBtn = screen.getByRole("button", { name: /crop image/i });
    fireEvent.click(cropBtn);

    expect(mockCropDialog).toHaveBeenCalledWith(
      expect.objectContaining({ open: true })
    );
  });

  it("updates the crop for an image when the crop dialog confirms", () => {
    const onChange = jest.fn();
    const images: NoteImageEntry[] = [
      { id: 1, file_path: "a.jpg", crop: null },
    ];

    renderWithProviders(
      <NoteImageManager chickenId={1} images={images} onChange={onChange} />
    );

    fireEvent.click(screen.getByRole("button", { name: /crop image/i }));
    fireEvent.click(screen.getByText("Confirm Crop"));

    expect(onChange).toHaveBeenCalledWith([
      {
        id: 1,
        file_path: "a.jpg",
        crop: { x_min: 10, y_min: 20, x_max: 110, y_max: 120 },
      },
    ]);
  });

  it("shows images already provided in the images prop", () => {
    const onChange = jest.fn();
    const images: NoteImageEntry[] = [
      { id: 1, file_path: "a.jpg", crop: null },
      { id: 2, file_path: "b.jpg", crop: { x_min: 0, y_min: 0, x_max: 50, y_max: 50 } },
    ];

    renderWithProviders(
      <NoteImageManager chickenId={1} images={images} onChange={onChange} />
    );

    const imgs = screen.getAllByRole("img");
    expect(imgs).toHaveLength(2);
  });
});
