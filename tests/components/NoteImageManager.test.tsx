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

// Mock EventSource for jsdom
class MockEventSource {
  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: (() => void) | null = null;
  close() {}
}
global.EventSource = MockEventSource as any;

import { screen, waitFor, fireEvent, act } from "@testing-library/react";
import { renderWithProviders } from "./test-utils";
import NoteImageManager from "@/components/NoteImageManager";
import type { NoteImageEntry } from "@/components/NoteImageManager";

const mockNoteImageCropDialog = jest.fn();
jest.mock("@/components/NoteImageCropDialog", () => ({
  __esModule: true,
  default: (props: {
    open: boolean;
    imageUrl: string;
    onCrop: (crop: { x: number; y: number; width: number; height: number }) => void;
    onCancel: () => void;
  }) => {
    mockNoteImageCropDialog(props);
    if (!props.open) return null;
    return (
      <div data-testid="note-image-crop-dialog">
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

const mockNoteImageReviewModal = jest.fn();
jest.mock("@/components/NoteImageReviewModal", () => ({
  __esModule: true,
  default: (props: {
    open: boolean;
    imageUrl: string;
    initialCrop: any;
    initialText: string;
    onSave: (crop: any, text: string) => void;
    onCancel: () => void;
    onResend?: (crop: any) => void;
    isResending?: boolean;
    error?: string | null;
    cropOnly?: boolean;
  }) => {
    mockNoteImageReviewModal(props);
    if (!props.open) return null;
    return (
      <div data-testid="note-image-review-modal">
        <button onClick={() => props.onSave({ x_min: 0, y_min: 0, x_max: 0.5, y_max: 0.5 }, "edited text")}>
          Save Review
        </button>
        <button onClick={props.onCancel}>Cancel Review</button>
        {props.onResend && (
          <button onClick={() => props.onResend!({ x_min: 0, y_min: 0, x_max: 0.5, y_max: 0.5 })}>
            Resend
          </button>
        )}
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
        { id: 42, file_path: "notes/abc.jpg", crop: null, status: "pending" },
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
      { id: 1, file_path: "a.jpg", crop: null, status: "pending" },
      { id: 2, file_path: "b.jpg", crop: null, status: "pending" },
    ];

    renderWithProviders(
      <NoteImageManager chickenId={1} images={images} onChange={onChange} />
    );

    const removeButtons = screen.getAllByRole("button", { name: /remove image/i });
    expect(removeButtons).toHaveLength(2);
    fireEvent.click(removeButtons[0]!);

    expect(onChange).toHaveBeenCalledWith([
      { id: 2, file_path: "b.jpg", crop: null, status: "pending" },
    ]);
  });

  it("opens the crop dialog when the thumbnail is clicked for a skipped image", () => {
    const onChange = jest.fn();
    const images: NoteImageEntry[] = [
      { id: 1, file_path: "a.jpg", crop: null, status: "skipped" },
    ];

    renderWithProviders(
      <NoteImageManager chickenId={1} images={images} onChange={onChange} />
    );

    const thumbnail = screen.getByAltText("Note image 1");
    fireEvent.click(thumbnail);

    expect(mockNoteImageCropDialog).toHaveBeenCalledWith(
      expect.objectContaining({ open: true })
    );
  });

  it("updates the crop for an image when the crop dialog confirms", () => {
    const onChange = jest.fn();
    const images: NoteImageEntry[] = [
      { id: 1, file_path: "a.jpg", crop: null, status: "skipped" },
    ];

    renderWithProviders(
      <NoteImageManager chickenId={1} images={images} onChange={onChange} />
    );

    const thumbnail = screen.getByAltText("Note image 1");
    fireEvent.click(thumbnail);
    fireEvent.click(screen.getByText("Confirm Crop"));

    expect(onChange).toHaveBeenCalledWith([
      {
        id: 1,
        file_path: "a.jpg",
        crop: { x_min: 0.1, y_min: 0.2, x_max: 1.1, y_max: 1.2 },
        status: "skipped",
      },
    ]);
  });

  it("shows images already provided in the images prop", () => {
    const onChange = jest.fn();
    const images: NoteImageEntry[] = [
      { id: 1, file_path: "a.jpg", crop: null, status: "pending" },
      { id: 2, file_path: "b.jpg", crop: { x_min: 0, y_min: 0, x_max: 0.5, y_max: 0.5 }, status: "succeeded" },
    ];

    renderWithProviders(
      <NoteImageManager chickenId={1} images={images} onChange={onChange} />
    );

    const imgs = screen.getAllByRole("img");
    expect(imgs).toHaveLength(2);
  });

  it("renders status badges matching each image's status", () => {
    const onChange = jest.fn();
    const images: NoteImageEntry[] = [
      { id: 1, file_path: "a.jpg", crop: null, status: "pending" },
      { id: 2, file_path: "b.jpg", crop: null, status: "processing" },
      { id: 3, file_path: "c.jpg", crop: null, status: "succeeded" },
      { id: 4, file_path: "d.jpg", crop: null, status: "failed" },
    ];

    renderWithProviders(
      <NoteImageManager chickenId={1} images={images} onChange={onChange} />
    );

    expect(screen.getByTestId("status-badge-1")).toHaveTextContent("Pending");
    expect(screen.getByTestId("status-badge-2")).toHaveTextContent("Processing");
    expect(screen.getByTestId("status-badge-3")).toHaveTextContent("AI suggested");
    expect(screen.getByTestId("status-badge-4")).toHaveTextContent("Failed");
  });

  it("shows a Retry button for failed images and calls PATCH on click", async () => {
    const onChange = jest.fn();
    const images: NoteImageEntry[] = [
      { id: 10, file_path: "fail.jpg", crop: null, status: "failed", ai_error: "AI broke" },
    ];
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 10, status: "pending", ai_error: null }),
    });

    renderWithProviders(
      <NoteImageManager chickenId={1} images={images} onChange={onChange} />
    );

    const retryBtn = screen.getByRole("button", { name: /retry ai/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/chickens/1/notes/images/10",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ action: "retry" }),
        })
      );
    });
  });

  it("does not show a Retry button for non-failed images", () => {
    const onChange = jest.fn();
    const images: NoteImageEntry[] = [
      { id: 1, file_path: "a.jpg", crop: null, status: "processing" },
      { id: 2, file_path: "b.jpg", crop: null, status: "succeeded" },
      { id: 3, file_path: "c.jpg", crop: null, status: "pending" },
    ];

    renderWithProviders(
      <NoteImageManager chickenId={1} images={images} onChange={onChange} />
    );

    expect(screen.queryByRole("button", { name: /retry ai/i })).not.toBeInTheDocument();
  });

  describe("thumbnail click routing", () => {
    it("opens NoteImageCropDialog when AI is disabled (status skipped)", () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "skipped" },
      ];

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      const thumbnail = screen.getByAltText("Note image 1");
      fireEvent.click(thumbnail);

      expect(mockNoteImageCropDialog).toHaveBeenCalledWith(
        expect.objectContaining({ open: true })
      );
      expect(mockNoteImageReviewModal).not.toHaveBeenCalledWith(
        expect.objectContaining({ open: true })
      );
    });

    it("opens NoteImageReviewModal when AI is enabled and status is succeeded", () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "succeeded", ai_suggestion: "Hello world" },
      ];

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      const thumbnail = screen.getByAltText("Note image 1");
      fireEvent.click(thumbnail);

      expect(mockNoteImageReviewModal).toHaveBeenCalledWith(
        expect.objectContaining({ open: true, initialText: "Hello world" })
      );
      expect(mockNoteImageCropDialog).not.toHaveBeenCalledWith(
        expect.objectContaining({ open: true })
      );
    });

    it("blocks thumbnail click when AI is processing (status pending)", () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "pending" },
      ];

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      const thumbnail = screen.getByAltText("Note image 1");
      fireEvent.click(thumbnail);

      expect(mockNoteImageCropDialog).not.toHaveBeenCalledWith(
        expect.objectContaining({ open: true })
      );
      expect(mockNoteImageReviewModal).not.toHaveBeenCalledWith(
        expect.objectContaining({ open: true })
      );
    });

    it("blocks thumbnail click when AI is processing (status processing)", () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "processing" },
      ];

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      const thumbnail = screen.getByAltText("Note image 1");
      fireEvent.click(thumbnail);

      expect(mockNoteImageCropDialog).not.toHaveBeenCalledWith(
        expect.objectContaining({ open: true })
      );
      expect(mockNoteImageReviewModal).not.toHaveBeenCalledWith(
        expect.objectContaining({ open: true })
      );
    });

    it("opens NoteImageReviewModal in error state when AI has failed", () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "failed", ai_error: "AI broke" },
      ];

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      const thumbnail = screen.getByAltText("Note image 1");
      fireEvent.click(thumbnail);

      expect(mockNoteImageReviewModal).toHaveBeenCalledWith(
        expect.objectContaining({ open: true, error: "AI broke" })
      );
    });

    it("shows the Resend button when the review modal opens in error state", () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "failed", ai_error: "AI broke" },
      ];

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      fireEvent.click(screen.getByAltText("Note image 1"));

      expect(screen.getByText("Resend")).toBeInTheDocument();
    });

    it("sends PATCH resend with the crop when Resend is clicked from error state", async () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "failed", ai_error: "AI broke" },
      ];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1, status: "processing" }),
      });

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      fireEvent.click(screen.getByAltText("Note image 1"));
      fireEvent.click(screen.getByText("Resend"));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/chickens/1/notes/images/1",
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({
              action: "resend",
              crop: { x_min: 0, y_min: 0, x_max: 0.5, y_max: 0.5 },
            }),
          })
        );
      });
    });

    it("locks the modal during resend from error state", async () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "failed", ai_error: "AI broke" },
      ];
      let resolveFetch: (v: unknown) => void;
      (global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise((r) => { resolveFetch = r; })
      );

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      fireEvent.click(screen.getByAltText("Note image 1"));
      fireEvent.click(screen.getByText("Resend"));

      await waitFor(() => {
        expect(mockNoteImageReviewModal).toHaveBeenCalledWith(
          expect.objectContaining({ isResending: true, error: "AI broke" })
        );
      });

      await act(async () => {
        resolveFetch!({
          ok: true,
          json: () => Promise.resolve({ id: 1, status: "processing" }),
        });
      });
    });

    it("saves crop and text from review modal back via onChange", () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "succeeded", ai_suggestion: "original" },
      ];

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      fireEvent.click(screen.getByAltText("Note image 1"));
      fireEvent.click(screen.getByText("Save Review"));

      expect(onChange).toHaveBeenCalledWith([
        {
          id: 1,
          file_path: "a.jpg",
          crop: { x_min: 0, y_min: 0, x_max: 0.5, y_max: 0.5 },
          status: "succeeded",
          ai_suggestion: "edited text",
          ai_error: null,
        },
      ]);
    });

    it("saves crop from crop dialog back via onChange", () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "skipped" },
      ];

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      fireEvent.click(screen.getByAltText("Note image 1"));
      fireEvent.click(screen.getByText("Confirm Crop"));

      expect(onChange).toHaveBeenCalledWith([
        {
          id: 1,
          file_path: "a.jpg",
          crop: { x_min: 0.1, y_min: 0.2, x_max: 1.1, y_max: 1.2 },
          status: "skipped",
        },
      ]);
    });

    it("closes review modal on cancel", () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "succeeded", ai_suggestion: "text" },
      ];

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      fireEvent.click(screen.getByAltText("Note image 1"));
      expect(screen.getByTestId("note-image-review-modal")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Cancel Review"));

      expect(screen.queryByTestId("note-image-review-modal")).not.toBeInTheDocument();
    });

    it("closes crop dialog on cancel", () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "skipped" },
      ];

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      fireEvent.click(screen.getByAltText("Note image 1"));
      expect(screen.getByTestId("note-image-crop-dialog")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Cancel Crop"));

      expect(screen.queryByTestId("note-image-crop-dialog")).not.toBeInTheDocument();
    });
  });

  describe("resend flow", () => {
    it("passes onResend to the review modal", () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "succeeded", ai_suggestion: "text" },
      ];

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      fireEvent.click(screen.getByAltText("Note image 1"));

      expect(mockNoteImageReviewModal).toHaveBeenCalledWith(
        expect.objectContaining({ onResend: expect.any(Function) })
      );
    });

    it("sends PATCH resend with the crop when Resend is clicked", async () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "succeeded", ai_suggestion: "text" },
      ];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1, status: "processing" }),
      });

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      fireEvent.click(screen.getByAltText("Note image 1"));
      fireEvent.click(screen.getByText("Resend"));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/chickens/1/notes/images/1",
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({
              action: "resend",
              crop: { x_min: 0, y_min: 0, x_max: 0.5, y_max: 0.5 },
            }),
          })
        );
      });
    });

    it("passes isResending true while resend is in flight", async () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "succeeded", ai_suggestion: "text" },
      ];
      let resolveFetch: (v: unknown) => void;
      (global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise((r) => { resolveFetch = r; })
      );

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      fireEvent.click(screen.getByAltText("Note image 1"));
      fireEvent.click(screen.getByText("Resend"));

      await waitFor(() => {
        expect(mockNoteImageReviewModal).toHaveBeenCalledWith(
          expect.objectContaining({ isResending: true })
        );
      });

      await act(async () => {
        resolveFetch!({
          ok: true,
          json: () => Promise.resolve({ id: 1, status: "processing" }),
        });
      });
    });

    it("passes isResending false initially", () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "succeeded", ai_suggestion: "text" },
      ];

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      fireEvent.click(screen.getByAltText("Note image 1"));

      expect(mockNoteImageReviewModal).toHaveBeenCalledWith(
        expect.objectContaining({ isResending: false })
      );
    });

    it("unlocks the modal when resend fails", async () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "succeeded", ai_suggestion: "text" },
      ];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
      });

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      fireEvent.click(screen.getByAltText("Note image 1"));
      fireEvent.click(screen.getByText("Resend"));

      await waitFor(() => {
        expect(mockNoteImageReviewModal).toHaveBeenCalledWith(
          expect.objectContaining({ isResending: false })
        );
      });
    });
  });

  describe("saved images", () => {
    it("shows a 'Saved' badge for images with isSaved true", () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "skipped", isSaved: true },
      ];

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      expect(screen.getByTestId("status-badge-1")).toHaveTextContent("Saved");
    });

    it("opens the review modal in crop-only mode when a saved image thumbnail is clicked", () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "skipped", isSaved: true },
      ];

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      const thumbnail = screen.getByAltText("Note image 1");
      fireEvent.click(thumbnail);

      expect(mockNoteImageReviewModal).toHaveBeenCalledWith(
        expect.objectContaining({ open: true, cropOnly: true })
      );
      expect(mockNoteImageCropDialog).not.toHaveBeenCalledWith(
        expect.objectContaining({ open: true })
      );
    });

    it("does not pass onResend to the review modal for saved images", () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "skipped", isSaved: true },
      ];

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      const thumbnail = screen.getByAltText("Note image 1");
      fireEvent.click(thumbnail);

      expect(mockNoteImageReviewModal).toHaveBeenCalledWith(
        expect.objectContaining({ onResend: undefined })
      );
    });

    it("does not show a Retry button for saved images", () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "failed", ai_error: "error", isSaved: true },
      ];

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      expect(screen.queryByRole("button", { name: /retry ai/i })).not.toBeInTheDocument();
    });

    it("updates the crop without setting ai_suggestion when the review modal saves for a saved image", () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "skipped", isSaved: true },
      ];

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      const thumbnail = screen.getByAltText("Note image 1");
      fireEvent.click(thumbnail);
      fireEvent.click(screen.getByText("Save Review"));

      expect(onChange).toHaveBeenCalledWith([
        {
          id: 1,
          file_path: "a.jpg",
          crop: { x_min: 0, y_min: 0, x_max: 0.5, y_max: 0.5 },
          status: "skipped",
          isSaved: true,
        },
      ]);
    });

    it("allows removing a saved image", () => {
      const onChange = jest.fn();
      const images: NoteImageEntry[] = [
        { id: 1, file_path: "a.jpg", crop: null, status: "skipped", isSaved: true },
        { id: 2, file_path: "b.jpg", crop: null, status: "pending" },
      ];

      renderWithProviders(
        <NoteImageManager chickenId={1} images={images} onChange={onChange} />
      );

      const removeButtons = screen.getAllByRole("button", { name: /remove image/i });
      expect(removeButtons).toHaveLength(2);
      fireEvent.click(removeButtons[0]!);

      expect(onChange).toHaveBeenCalledWith([
        { id: 2, file_path: "b.jpg", crop: null, status: "pending" },
      ]);
    });
  });
});
