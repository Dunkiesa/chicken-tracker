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

describe("NoteImageCropDialog", () => {
  it("does not render when open is false", () => {
    const onCrop = jest.fn();
    const onCancel = jest.fn();

    renderWithProviders(
      <NoteImageCropDialog
        open={false}
        imageUrl="/test-image.jpg"
        onCrop={onCrop}
        onCancel={onCancel}
      />
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the dialog when open is true", () => {
    const onCrop = jest.fn();
    const onCancel = jest.fn();

    renderWithProviders(
      <NoteImageCropDialog
        open={true}
        imageUrl="/test-image.jpg"
        onCrop={onCrop}
        onCancel={onCancel}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("displays the image via the cropper", () => {
    const onCrop = jest.fn();
    const onCancel = jest.fn();

    renderWithProviders(
      <NoteImageCropDialog
        open={true}
        imageUrl="/test-image.jpg"
        onCrop={onCrop}
        onCancel={onCancel}
      />
    );

    expect(screen.getByTestId("mock-cropper")).toBeInTheDocument();
    expect(mockCropper).toHaveBeenCalledWith(
      expect.objectContaining({
        image: "/test-image.jpg",
      })
    );
  });

  it("renders Save and Cancel buttons", () => {
    const onCrop = jest.fn();
    const onCancel = jest.fn();

    renderWithProviders(
      <NoteImageCropDialog
        open={true}
        imageUrl="/test-image.jpg"
        onCrop={onCrop}
        onCancel={onCancel}
      />
    );

    expect(
      screen.getByRole("button", { name: /cancel/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save/i })
    ).toBeInTheDocument();
  });

  it("calls onCancel when Cancel button is clicked", () => {
    const onCrop = jest.fn();
    const onCancel = jest.fn();

    renderWithProviders(
      <NoteImageCropDialog
        open={true}
        imageUrl="/test-image.jpg"
        onCrop={onCrop}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCrop with the crop area when Save is clicked", () => {
    const onCrop = jest.fn();
    const onCancel = jest.fn();

    renderWithProviders(
      <NoteImageCropDialog
        open={true}
        imageUrl="/test-image.jpg"
        onCrop={onCrop}
        onCancel={onCancel}
      />
    );

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
    const onCrop = jest.fn();
    const onCancel = jest.fn();

    renderWithProviders(
      <NoteImageCropDialog
        open={true}
        imageUrl="/test-image.jpg"
        onCrop={onCrop}
        onCancel={onCancel}
      />
    );

    const cropperProps = mockCropper.mock.calls[0][0];
    expect(cropperProps.aspect).toBeUndefined();
  });

  it("does not use round crop shape", () => {
    const onCrop = jest.fn();
    const onCancel = jest.fn();

    renderWithProviders(
      <NoteImageCropDialog
        open={true}
        imageUrl="/test-image.jpg"
        onCrop={onCrop}
        onCancel={onCancel}
      />
    );

    expect(mockCropper).toHaveBeenCalledWith(
      expect.objectContaining({
        cropShape: "rect",
      })
    );
  });
});
