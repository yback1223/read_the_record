"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import SignOutButton from "@/components/SignOutButton";

type NavItem = {
  href: string;
  label: string;
  match: (path: string) => boolean;
  icon: React.ReactNode;
};

export default function Shell({
  children,
  userEmail,
  nickname,
  isSuperAdmin = false,
}: {
  children: React.ReactNode;
  userEmail?: string;
  nickname?: string | null;
  isSuperAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const v = window.localStorage.getItem("reading:sidebar-collapsed");
    if (v === "1") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(
          "reading:sidebar-collapsed",
          next ? "1" : "0",
        );
      } catch {
        // ignore
      }
      return next;
    });
  }

  const items: NavItem[] = [
    {
      href: "/",
      label: "서재",
      match: (p) => p === "/" || p.startsWith("/books"),
      icon: (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M2 3h4.5a1.5 1.5 0 0 1 1.5 1.5V13a1.5 1.5 0 0 0-1.5-1.5H2V3zm12 0H9.5A1.5 1.5 0 0 0 8 4.5V13a1.5 1.5 0 0 1 1.5-1.5H14V3z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      href: "/books/new",
      label: "책 담기",
      match: (p) => p === "/books/new",
      icon: (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 3v10M3 8h10"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
  ];

  const adminItem: NavItem = {
    href: "/admin",
    label: "관리자",
    match: (p) => p.startsWith("/admin"),
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 1.5l6 2.5v4.5c0 3.5-2.4 5.7-6 6-3.6-.3-6-2.5-6-6V4l6-2.5z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    ),
  };

  return (
    <div className="flex min-h-dvh">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r hairline bg-[color:var(--paper-2)] ${
          open
            ? "translate-x-0 shadow-[24px_0_60px_-30px_rgba(70,50,20,0.45)]"
            : "-translate-x-full shadow-none"
        } ${
          collapsed
            ? "md:!w-0 md:!-translate-x-full md:!border-r-0"
            : "md:!w-[280px] md:!translate-x-0"
        } md:static md:!shadow-none`}
        style={{
          willChange: "transform, width",
          transitionProperty: "transform, box-shadow, width",
          transitionDuration: "520ms",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          overflow: "hidden",
        }}
      >
        <div className="flex h-20 items-center justify-between gap-2 pr-3">
          <Link
            href="/"
            className="flex flex-1 items-center gap-3 px-6"
            aria-label="Read The Record"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="h-12 w-12" />
            <span className="serif text-[15px] leading-tight tracking-[0.04em] text-[color:var(--ink)]">
              Read<br />The Record
            </span>
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="사이드바 접기"
            className="hidden h-8 w-8 items-center justify-center rounded-full border hairline text-[color:var(--ink-muted)] hover:text-[color:var(--ink)] hover:border-[color:var(--rule-strong)] md:flex"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 3 L4 8 L10 13"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="mx-6 h-px bg-[color:var(--rule)]" />

        <nav className="flex flex-col gap-1 px-4 pt-5">
          {items.map((it, idx) => (
            <NavLink
              key={it.href}
              item={it}
              active={it.match(pathname)}
              delay={open ? 120 + idx * 60 : 0}
            />
          ))}
        </nav>

        {isSuperAdmin && (
          <>
            <div className="mx-6 mt-5 h-px bg-[color:var(--rule)]" />
            <p className="px-6 pt-4 text-[10px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
              관리
            </p>
            <nav className="flex flex-col gap-1 px-4 pt-2">
              <NavLink item={adminItem} active={adminItem.match(pathname)} />
            </nav>
          </>
        )}

        <div className="mt-auto border-t hairline px-6 py-5">
          {nickname && (
            <p className="serif truncate text-[14px] text-[color:var(--ink)]">
              {nickname}
            </p>
          )}
          <p className="mt-0.5 truncate text-[11px] text-[color:var(--ink-soft)]">
            {userEmail}
          </p>
          <div className="mt-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div
        className={`fixed inset-0 z-30 md:hidden ${
          open
            ? "opacity-100 pointer-events-auto backdrop-blur-[3px]"
            : "opacity-0 pointer-events-none backdrop-blur-0"
        }`}
        onClick={() => setOpen(false)}
        style={{
          background:
            "radial-gradient(120% 80% at 30% 30%, rgba(20,12,4,0.42), rgba(20,12,4,0.18))",
          willChange: "opacity, backdrop-filter",
          transitionProperty: "opacity, backdrop-filter",
          transitionDuration: "520ms",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />

      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label="사이드바 펼치기"
        className={`fixed left-4 top-4 z-30 hidden h-9 w-9 items-center justify-center rounded-full border hairline bg-[color:var(--paper-2)] text-[color:var(--ink-muted)] hover:text-[color:var(--ink)] hover:border-[color:var(--rule-strong)] md:flex ${
          collapsed ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        style={{
          transitionProperty: "opacity",
          transitionDuration: "320ms",
          transitionDelay: collapsed ? "300ms" : "0ms",
          boxShadow: "0 6px 20px -10px rgba(70,50,20,0.35)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M6 3 L12 8 L6 13"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b hairline bg-[color:var(--paper)]/85 px-5 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full border hairline text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
            aria-label="메뉴"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 4h12M2 8h12M2 12h12"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="h-7 w-7" />
          <span className="serif text-base tracking-[0.04em]">
            Read The Record
          </span>
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

function NavLink({
  item,
  active,
  delay = 0,
}: {
  item: NavItem;
  active: boolean;
  delay?: number;
}) {
  return (
    <Link
      href={item.href}
      style={{
        transitionDelay: `${delay}ms`,
      }}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] tracking-wide ${
        active
          ? "bg-[color:var(--paper)] text-[color:var(--accent)] shadow-[inset_2px_0_0_0_var(--accent)]"
          : "text-[color:var(--ink-muted)] hover:bg-[color:var(--paper)] hover:text-[color:var(--ink)]"
      }`}
    >
      <span className="flex h-5 w-5 items-center justify-center">
        {item.icon}
      </span>
      {item.label}
    </Link>
  );
}
