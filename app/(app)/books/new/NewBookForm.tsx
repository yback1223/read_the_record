"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewBookForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, author }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "저장 실패");
      setBusy(false);
      return;
    }
    const book = await res.json();
    router.replace(`/books/${book.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="paper-card flex flex-col gap-5 px-6 py-8">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
          제목
        </span>
        <input
          autoFocus
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg border hairline bg-[color:var(--paper)] px-4 py-3 text-base"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
          저자 (선택)
        </span>
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="rounded-lg border hairline bg-[color:var(--paper)] px-4 py-3 text-base"
        />
      </label>

      {error && (
        <p
          className="rounded-md px-3 py-2 text-xs"
          style={{
            background: "color-mix(in oklab, var(--danger) 10%, transparent)",
            color: "var(--danger)",
          }}
        >
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border hairline px-5 py-2 text-[11px] uppercase tracking-wider text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="rounded-full px-5 py-2 text-[11px] uppercase tracking-wider text-[color:var(--paper)] disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {busy ? "담는 중…" : "서재에 담기"}
        </button>
      </div>
    </form>
  );
}
