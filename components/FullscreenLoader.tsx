"use client";

import BookshelfLoader from "@/components/BookshelfLoader";

export default function FullscreenLoader({
  show,
  label,
}: {
  show: boolean;
  label?: string;
}) {
  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-0 z-[70] flex items-center justify-center ${
        show ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      style={{
        background:
          "radial-gradient(120% 80% at 30% 30%, color-mix(in oklab, var(--paper) 92%, transparent), color-mix(in oklab, var(--paper) 78%, transparent))",
        backdropFilter: show ? "blur(6px)" : "blur(0)",
        WebkitBackdropFilter: show ? "blur(6px)" : "blur(0)",
        transitionProperty: "opacity, backdrop-filter",
        transitionDuration: "320ms",
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <BookshelfLoader label={label ?? "잠깐만요…"} />
    </div>
  );
}
