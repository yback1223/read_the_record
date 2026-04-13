"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type View = "grid" | "list";

export default function LibraryToolbar({
  initialQ,
  initialView,
  initialSize,
}: {
  initialQ: string;
  initialView: View;
  initialSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [q, setQ] = useState(initialQ);

  useEffect(() => {
    setQ(initialQ);
  }, [initialQ]);

  function pushParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function onSubmitSearch(e: React.FormEvent) {
    e.preventDefault();
    pushParams({ q: q.trim() || undefined });
  }

  function clearSearch() {
    setQ("");
    pushParams({ q: undefined });
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <form onSubmit={onSubmitSearch} className="relative md:w-80">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="제목·저자로 검색"
          className="w-full rounded-lg border hairline bg-[color:var(--paper-2)] py-2.5 pl-10 pr-9 text-sm placeholder:text-[color:var(--ink-soft)]"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
        >
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="m11 11 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        {q && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="지우기"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[10px] text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
          >
            ✕
          </button>
        )}
      </form>

      <div className="flex items-center gap-2">
        <SizeSelect
          value={initialSize}
          onChange={(n) => pushParams({ size: String(n) })}
        />
        <ViewToggle
          value={initialView}
          onChange={(v) => pushParams({ view: v })}
        />
      </div>
    </div>
  );
}

function SizeSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-full border hairline px-3 py-1.5 text-[11px] uppercase tracking-wider text-[color:var(--ink-muted)]">
      <span>보기</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-transparent text-[color:var(--ink)] outline-none"
      >
        <option value={12}>12개</option>
        <option value={24}>24개</option>
        <option value={48}>48개</option>
        <option value={96}>96개</option>
      </select>
    </label>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: View;
  onChange: (v: View) => void;
}) {
  return (
    <div className="flex items-center rounded-full border hairline p-0.5">
      <ToggleButton active={value === "grid"} onClick={() => onChange("grid")}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="5" height="5" rx="0.6" stroke="currentColor" strokeWidth="1.2" />
          <rect x="9" y="2" width="5" height="5" rx="0.6" stroke="currentColor" strokeWidth="1.2" />
          <rect x="2" y="9" width="5" height="5" rx="0.6" stroke="currentColor" strokeWidth="1.2" />
          <rect x="9" y="9" width="5" height="5" rx="0.6" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </ToggleButton>
      <ToggleButton active={value === "list"} onClick={() => onChange("list")}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M3 4h10M3 8h10M3 12h10"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </ToggleButton>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
