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

import { screen, fireEvent, act } from "@testing-library/react";
import { renderWithProviders } from "./test-utils";
import NoteImageReviewModal from "@/components/NoteImageReviewModal";

beforeEach(() => {
  jest.clearAllMocks();
});

function renderModal(
  overrides: Partial<{
    open: boolean;
    imageUrl: string;
    initialCrop: { x_min: number; y_min: number; x_max: number; y_max: number } | null;
    initialText: string;
    onSave: jest.Mock;
    onCancel: jest.Mock;
    onResend: jest.Mock;
    isResending: boolean;
    error: string | null;
  }> = {}
) {
  const onSave = overrides.onSave ?? jest.fn();
  const onCancel = overrides.onCancel ?? jest.fn();
  const onResend = overrides.onResend ?? jest.fn();
  const initialCrop: { x_min: number; y_min: number; x_max: number; y_max: number } | null =
    "initialCrop" in overrides ? overrides.initialCrop! : { x_min: 0.1, y_min: 0.2, x_max: 0.5, y_max: 0.6 };
  const utils = renderWithProviders(
    <NoteImageReviewModal
      open={overrides.open ?? true}
      imageUrl={overrides.imageUrl ?? "/test-image.jpg"}
      initialCrop={initialCrop}
      initialText={overrides.initialText ?? "AI suggested text"}
      onSave={onSave}
      onCancel={onCancel}
      onResend={onResend}
      isResending={overrides.isResending ?? false}
      error={overrides.error ?? null}
    />
  );
  return { ...utils, onSave, onCancel, onResend };
}

function mockImageDimensions(width: number, height: number) {
  const img = screen.getByRole("img", { name: /note image/i });
  Object.defineProperty(img, "naturalWidth", { value: width, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: height, configurable: true });
  fireEvent.load(img);
}

function mockContainerDimensions(width: number, height: number) {
  const cropRect = screen.queryByTestId("crop-rectangle");
  if (cropRect) {
    const container = cropRect.parentElement;
    if (container) {
      Object.defineProperty(container, "offsetWidth", { value: width, configurable: true });
      Object.defineProperty(container, "offsetHeight", { value: height, configurable: true });
    }
  }
}

describe("NoteImageReviewModal", () => {
  it("does not render when open is false", () => {
    renderModal({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the dialog when open is true", () => {
    renderModal({ open: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("displays the image", () => {
    renderModal({ imageUrl: "/custom-image.jpg" });
    const img = screen.getByRole("img", { name: /note image/i });
    expect(img).toHaveAttribute("src", "/custom-image.jpg");
  });

  it("shows the AI's suggested text in an editable field", () => {
    renderModal({ initialText: "Vet visit notes" });
    const textField = screen.getByRole("textbox");
    expect(textField).toHaveValue("Vet visit notes");
  });

  it("allows editing the text", () => {
    renderModal({ initialText: "Original text" });
    const textField = screen.getByRole("textbox");
    fireEvent.change(textField, { target: { value: "Edited text" } });
    expect(textField).toHaveValue("Edited text");
  });

  it("calls onSave with crop and text when Save is clicked", () => {
    const { onSave } = renderModal({
      initialCrop: { x_min: 0.1, y_min: 0.2, x_max: 0.5, y_max: 0.6 },
      initialText: "AI text",
    });
    mockImageDimensions(1000, 800);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith(
      { x_min: 0.1, y_min: 0.2, x_max: 0.5, y_max: 0.6 },
      "AI text"
    );
  });

  it("calls onCancel when Cancel is clicked", () => {
    const { onCancel } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onResend with crop when Resend is clicked", () => {
    const { onResend } = renderModal({
      initialCrop: { x_min: 0.1, y_min: 0.2, x_max: 0.5, y_max: 0.6 },
    });
    mockImageDimensions(1000, 800);
    fireEvent.click(screen.getByRole("button", { name: /resend/i }));
    expect(onResend).toHaveBeenCalledWith({
      x_min: 0.1,
      y_min: 0.2,
      x_max: 0.5,
      y_max: 0.6,
    });
  });

  it("locks the UI during resend", () => {
    renderModal({ isResending: true });
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: /resend/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("shows a spinner on the Resend button during resend", () => {
    renderModal({ isResending: true });
    const resendBtn = screen.getByRole("button", { name: /resend/i });
    expect(resendBtn.querySelector(".MuiCircularProgress-root")).toBeTruthy();
  });

  it("shows error message when error is present", () => {
    renderModal({ error: "AI processing failed" });
    expect(screen.getByText("AI processing failed")).toBeInTheDocument();
  });

  it("initializes the crop rectangle to the AI's bounding box", () => {
    renderModal({
      initialCrop: { x_min: 0.1, y_min: 0.2, x_max: 0.5, y_max: 0.6 },
    });
    mockImageDimensions(1000, 800);
    mockContainerDimensions(1000, 800);
    act(() => {
      mockImageDimensions(1000, 800);
    });
    const cropRect = screen.getByTestId("crop-rectangle");
    expect(cropRect).toBeInTheDocument();
    expect(cropRect.style.left).toBe("10%");
    expect(cropRect.style.top).toBe("20%");
    expect(cropRect.style.width).toBe("40%");
    expect(cropRect.style.height).toBe("40%");
  });

  it("updates text after resend completes", () => {
    const onSave = jest.fn();
    const onCancel = jest.fn();
    const onResend = jest.fn();
    const { rerender } = renderWithProviders(
      <NoteImageReviewModal
        open={true}
        imageUrl="/test-image.jpg"
        initialCrop={{ x_min: 0.1, y_min: 0.2, x_max: 0.5, y_max: 0.6 }}
        initialText="Old text"
        onSave={onSave}
        onCancel={onCancel}
        onResend={onResend}
        isResending={true}
        error={null}
      />
    );

    rerender(
      <NoteImageReviewModal
        open={true}
        imageUrl="/test-image.jpg"
        initialCrop={{ x_min: 0.1, y_min: 0.2, x_max: 0.5, y_max: 0.6 }}
        initialText="New text"
        onSave={onSave}
        onCancel={onCancel}
        onResend={onResend}
        isResending={false}
        error={null}
      />
    );

    const textField = screen.getByRole("textbox");
    expect(textField).toHaveValue("New text");
  });

  it("defaults to full image crop when initialCrop is null", () => {
    renderModal({ initialCrop: null });
    mockImageDimensions(1000, 800);
    mockContainerDimensions(1000, 800);
    act(() => {
      mockImageDimensions(1000, 800);
    });
    const cropRect = screen.getByTestId("crop-rectangle");
    expect(cropRect.style.left).toBe("0%");
    expect(cropRect.style.top).toBe("0%");
    expect(cropRect.style.width).toBe("100%");
    expect(cropRect.style.height).toBe("100%");
  });

  it("does not show Resend button when onResend is not provided", () => {
    renderWithProviders(
      <NoteImageReviewModal
        open={true}
        imageUrl="/test-image.jpg"
        initialCrop={null}
        initialText="text"
        onSave={jest.fn()}
        onCancel={jest.fn()}
        isResending={false}
        error={null}
      />
    );
    expect(screen.queryByRole("button", { name: /resend/i })).not.toBeInTheDocument();
  });

  it("renders resize handles on the crop rectangle", () => {
    renderModal({ initialCrop: { x_min: 0.1, y_min: 0.2, x_max: 0.5, y_max: 0.6 } });
    mockImageDimensions(1000, 800);
    expect(screen.getByTestId("handle-tl")).toBeInTheDocument();
    expect(screen.getByTestId("handle-tr")).toBeInTheDocument();
    expect(screen.getByTestId("handle-bl")).toBeInTheDocument();
    expect(screen.getByTestId("handle-br")).toBeInTheDocument();
  });

  it("does not render resize handles during resend", () => {
    renderModal({ isResending: true });
    expect(screen.queryByTestId("handle-tl")).not.toBeInTheDocument();
    expect(screen.queryByTestId("handle-tr")).not.toBeInTheDocument();
    expect(screen.queryByTestId("handle-bl")).not.toBeInTheDocument();
    expect(screen.queryByTestId("handle-br")).not.toBeInTheDocument();
  });

  it("resize handles have correct cursor styles", () => {
    renderModal({ initialCrop: { x_min: 0, y_min: 0, x_max: 0.4, y_max: 0.4 } });
    mockImageDimensions(1000, 800);
    expect(screen.getByTestId("handle-tl")).toHaveStyle({ cursor: "nwse-resize" });
    expect(screen.getByTestId("handle-tr")).toHaveStyle({ cursor: "nesw-resize" });
    expect(screen.getByTestId("handle-bl")).toHaveStyle({ cursor: "nesw-resize" });
    expect(screen.getByTestId("handle-br")).toHaveStyle({ cursor: "nwse-resize" });
  });
});
