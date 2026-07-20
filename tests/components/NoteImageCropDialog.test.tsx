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
import NoteImageCropDialog from "@/components/NoteImageCropDialog";

const mockCropper = jest.fn();
jest.mock("react-easy-crop", () => ({
  __esModule: true,
  default: (props: any) => {
    mockCropper(props);
    return (
      <div data-testid="mock-cropper">
        <button
          data-testid="trigger-crop-complete"
          onClick={() =>
            props.onCropComplete?.(
              { x: 10, y: 20, width: 100, height: 80 },
              { x: 10, y: 20, width: 100, height: 80 }
            )
          }
        >
          Trigger Crop Complete
        </button>
      </div>
    );
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function renderDialog(overrides: Partial<{
  open: boolean;
  imageUrl: string;
  onCrop: jest.Mock;
  onCancel: jest.Mock;
}> = {}) {
  const onCrop = overrides.onCrop ?? jest.fn();
  const onCancel = overrides.onCancel ?? jest.fn();
  const utils = renderWithProviders(
    <NoteImageCropDialog
      open={overrides.open ?? true}
      imageUrl={overrides.imageUrl ?? "/test-image.jpg"}
      onCrop={onCrop}
      onCancel={onCancel}
    />
  );
  return { ...utils, onCrop, onCancel };
}

describe("NoteImageCropDialog", () => {
  it("does not render when open is false", () => {
    renderDialog({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the dialog when open is true", () => {
    renderDialog({ open: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("displays the image via the cropper", () => {
    renderDialog({ imageUrl: "/custom-image.jpg" });
    expect(screen.getByTestId("mock-cropper")).toBeInTheDocument();
    expect(mockCropper).toHaveBeenCalledWith(
      expect.objectContaining({
        image: "/custom-image.jpg",
      })
    );
  });

  it("renders Save and Cancel buttons", () => {
    renderDialog();
    expect(
      screen.getByRole("button", { name: /cancel/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save/i })
    ).toBeInTheDocument();
  });

  it("calls onCancel when Cancel button is clicked", () => {
    const { onCancel } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCrop with the crop area when Save is clicked", () => {
    const { onCrop } = renderDialog();
    fireEvent.click(screen.getByTestId("trigger-crop-complete"));
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onCrop).toHaveBeenCalledWith({
      x: 10,
      y: 20,
      width: 100,
      height: 80,
    });
  });

  it("uses free-form crop (no aspect ratio lock)", () => {
    renderDialog();
    const cropperProps = mockCropper.mock.calls[0][0];
    expect(cropperProps.aspect).toBeUndefined();
  });

  it("does not use round crop shape", () => {
    renderDialog();
    expect(mockCropper).toHaveBeenCalledWith(
      expect.objectContaining({
        cropShape: "rect",
      })
    );
  });

  it("initializes crop position from initialCrop prop", () => {
    renderWithProviders(
      <NoteImageCropDialog
        open={true}
        imageUrl="/test-image.jpg"
        initialCrop={{ x_min: 0.1, y_min: 0.2, x_max: 0.5, y_max: 0.6 }}
        onCrop={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(mockCropper).toHaveBeenCalledWith(
      expect.objectContaining({
        crop: { x: 10, y: 20 },
      })
    );
  });

  it("defaults to origin when no initialCrop is provided", () => {
    renderDialog();
    expect(mockCropper).toHaveBeenCalledWith(
      expect.objectContaining({
        crop: { x: 0, y: 0 },
      })
    );
  });
});
