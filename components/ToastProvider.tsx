"use client";

import { Toaster } from "sonner";

export default function ToastProvider() {
  return (
    <Toaster
      position="bottom-center"
      gap={8}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "paper-card flex items-center gap-3 px-5 py-4 w-full max-w-sm text-[13px] text-[color:var(--ink)]",
          title: "serif leading-snug",
          description: "text-[12px] text-[color:var(--ink-muted)] mt-0.5",
          actionButton:
            "rounded-full px-3 py-1 text-[11px] uppercase tracking-wider text-[color:var(--paper)] ml-auto shrink-0",
          closeButton:
            "text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]",
        },
      }}
    />
  );
}
