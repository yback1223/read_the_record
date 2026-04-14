import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #f6f1e7 0%, #ead9b8 100%)",
          position: "relative",
        }}
      >
        {/* frame */}
        <div
          style={{
            position: "absolute",
            inset: 12,
            border: "1.5px solid #d4c9b2",
            borderRadius: 28,
            display: "flex",
          }}
        />

        {/* book spines */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 4,
            marginBottom: 8,
          }}
        >
          <div style={{ width: 11, height: 44, borderRadius: 2, background: "#8a4a23" }} />
          <div style={{ width: 11, height: 52, borderRadius: 2, background: "#2b2520" }} />
          <div style={{ width: 11, height: 40, borderRadius: 2, background: "#b9733f" }} />
          <div style={{ width: 11, height: 48, borderRadius: 2, background: "#7a7168" }} />
          <div style={{ width: 11, height: 44, borderRadius: 2, background: "#8a4a23" }} />
        </div>

        {/* shelf line */}
        <div
          style={{
            width: 88,
            height: 4,
            borderRadius: 2,
            background: "linear-gradient(180deg,#d4c9b2,#b29e75)",
            marginBottom: 14,
          }}
        />

        {/* monogram */}
        <div
          style={{
            fontSize: 22,
            color: "#2b2520",
            fontFamily: "serif",
            fontWeight: 700,
            letterSpacing: 3,
            display: "flex",
          }}
        >
          RTR
        </div>
      </div>
    ),
    { ...size },
  );
}
