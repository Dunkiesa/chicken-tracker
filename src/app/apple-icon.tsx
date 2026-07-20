import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const runtime = "edge";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#AE9965",
          borderRadius: 32,
        }}
      >
        <svg
          width={120}
          height={120}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <ellipse cx="50" cy="54" rx="30" ry="38" fill="#FFFFFF" />
          <ellipse
            cx="50"
            cy="48"
            rx="24"
            ry="30"
            fill="#F5EDD8"
            opacity="0.4"
          />
        </svg>
      </div>
    ),
    { width: 180, height: 180 }
  );
}
