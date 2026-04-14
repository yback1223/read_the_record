"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "개요", match: (p: string) => p === "/admin" },
  {
    href: "/admin/users",
    label: "사용자",
    match: (p: string) => p.startsWith("/admin/users"),
  },
  {
    href: "/admin/activity",
    label: "활동",
    match: (p: string) => p.startsWith("/admin/activity"),
  },
];

export default function AdminNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="flex items-center gap-1 rounded-full border hairline bg-[color:var(--paper-2)] p-1">
      {items.map((it) => {
        const active = it.match(pathname);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex-1 rounded-full px-4 py-1.5 text-center text-[12px] tracking-wide ${
              active
                ? "bg-[color:var(--ink)] text-[color:var(--paper)]"
                : "text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
