import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f1e7",
          fontSize: 40,
          fontWeight: 700,
          color: "#2b2520",
          fontFamily: "serif",
          letterSpacing: "-2px",
        }}
      >
        R
      </div>
    ),
    { ...size },
  );
}
