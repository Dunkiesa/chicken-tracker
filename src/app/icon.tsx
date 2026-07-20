import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";
export const runtime = "edge";

export default function Icon({ params }: { params: { size?: string; maskable?: string } }) {
  const s = Number(params.size) || 512;
  const maskable = params.maskable === "true";
  const padding = maskable ? s * 0.15 : 0;
  const iconSize = s - padding * 2;

  return new ImageResponse(
    (
      <div
        style={{
          width: s,
          height: s,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: maskable ? "transparent" : "#AE9965",
          borderRadius: maskable ? 0 : s * 0.18,
        }}
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <ellipse
            cx="50"
            cy="54"
            rx="30"
            ry="38"
            fill={maskable ? "#AE9965" : "#FFFFFF"}
          />
          <ellipse
            cx="50"
            cy="48"
            rx="24"
            ry="30"
            fill={maskable ? "#C4B07E" : "#F5EDD8"}
            opacity="0.4"
          />
        </svg>
      </div>
    ),
    { width: s, height: s }
  );
}
