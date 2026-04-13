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
  isSuperAdmin = false,
}: {
  children: React.ReactNode;
  userEmail?: string;
  isSuperAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r hairline bg-[color:var(--paper-2)] md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:!translate-x-0`}
        style={{
          transitionProperty: "transform",
          transitionDuration: "360ms",
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div className="flex h-16 items-center px-6">
          <Link
            href="/"
            className="serif text-lg tracking-[0.04em] text-[color:var(--ink)]"
          >
            Read The Record
          </Link>
        </div>

        <div className="mx-6 h-px bg-[color:var(--rule)]" />

        <nav className="flex flex-col gap-1 px-4 pt-5">
          {items.map((it) => (
            <NavLink key={it.href} item={it} active={it.match(pathname)} />
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
          <p className="truncate text-[11px] text-[color:var(--ink-soft)]">
            {userEmail}
          </p>
          <div className="mt-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div
        className={`fixed inset-0 z-30 bg-black/30 md:hidden ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
        style={{ transitionProperty: "opacity", transitionDuration: "300ms" }}
      />

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
          <span className="serif text-base tracking-[0.04em]">
            Read The Record
          </span>
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
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
