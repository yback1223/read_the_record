"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "reading:theme";

function getInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(getInitialTheme());
    setMounted(true);
  }, []);

  function applyTheme(next: Theme) {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  return (
    <div
      className="flex items-center rounded-full border hairline p-0.5"
      role="group"
      aria-label="테마 선택"
    >
      <ThemeButton
        active={mounted && theme === "light"}
        onClick={() => applyTheme("light")}
        label="라이트 모드"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
          <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M8 1.5v1.5" />
            <path d="M8 13v1.5" />
            <path d="M1.5 8h1.5" />
            <path d="M13 8h1.5" />
            <path d="m3.3 3.3 1.06 1.06" />
            <path d="m11.64 11.64 1.06 1.06" />
            <path d="m3.3 12.7 1.06-1.06" />
            <path d="m11.64 4.36 1.06-1.06" />
          </g>
        </svg>
      </ThemeButton>
      <ThemeButton
        active={mounted && theme === "dark"}
        onClick={() => applyTheme("dark")}
        label="다크 모드"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M13 9.2A5.5 5.5 0 1 1 6.8 3a4.5 4.5 0 0 0 6.2 6.2z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </ThemeButton>
    </div>
  );
}

function ThemeButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={`flex h-7 w-8 items-center justify-center rounded-full ${
        active
          ? "bg-[color:var(--ink)] text-[color:var(--paper)]"
          : "text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
      }`}
    >
      {children}
    </button>
  );
}
